import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, Download, FileText, LayoutDashboard, LoaderCircle, Moon, Plus, Save, Search, Send, ShieldCheck, Users, Wrench, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { attendanceRoster, dateKey, defaultAttendanceRecord, initials, formatAttendanceDate, computeMonthlyAttendanceSummary, type AttendanceRecord, type AttendanceStatus, type Stage } from "./shared";
import { PageHeading } from "./OverviewHelpers";
import { MetricCard, StatusBadge } from "./primitives";
import { ATTENDANCE_STATUSES, attendanceCompletion, historicalAttendanceRecord, shiftDate, summarizeAttendance, timeOrderWarning, updateAttendance, type AttendanceDetail } from "@shared/attendanceRules";
import { ATTENDANCE_CREW_ROSTER } from "@shared/attendanceCrewRoster";

export function AttendanceView({
  records,
  setRecords,
  selectedDate,
  setSelectedDate,
}: {
  records: Record<string, AttendanceRecord>;
  setRecords: React.Dispatch<
    React.SetStateAction<Record<string, AttendanceRecord>>
  >;
  selectedDate: string;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"daily" | "summary">("daily");
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, AttendanceDetail>>({});
  const today = dateKey(new Date());
  const baseRecord = defaultAttendanceRecord(attendanceRoster);
  const record =
    records[selectedDate] ??
    (selectedDate === today
      ? baseRecord
      : historicalAttendanceRecord(baseRecord));
  const summary = summarizeAttendance(record);
  const marked = attendanceCompletion(record, attendanceRoster.length);
  const updateStatus = (employeeName: string, status: AttendanceStatus) =>
    setRecords(current => ({
      ...current,
      [selectedDate]: updateAttendance(record, employeeName, status),
    }));
  const updateDetail = (employeeName: string, patch: Partial<AttendanceDetail>) =>
    setDetails(current => ({
      ...current,
      [employeeName]: { ...current[employeeName], ...patch },
    }));

  const dayQuery = trpc.operations.getAttendance.useQuery(
    { date: selectedDate },
    {}
  );
  const saveDayMutation = trpc.operations.saveAttendance.useMutation();

  useEffect(() => {
    setDetails({});
    setExpandedEmployee(null);
  }, [selectedDate]);

  useEffect(() => {
    if (!dayQuery.data?.length) return;
    setRecords(current => {
      const next = { ...(current[selectedDate] ?? {}) };
      for (const row of dayQuery.data) {
        if (
          (ATTENDANCE_STATUSES as readonly string[]).includes(row.status)
        )
          next[row.employeeName] = row.status as AttendanceStatus;
      }
      return { ...current, [selectedDate]: next };
    });
    setDetails(() => {
      const merged: Record<string, AttendanceDetail> = {};
      for (const row of dayQuery.data ?? []) {
        if (row.checkIn || row.checkOut || row.note)
          merged[row.employeeName] = {
            checkIn: row.checkIn ?? undefined,
            checkOut: row.checkOut ?? undefined,
            note: row.note ?? undefined,
          };
      }
      return merged;
    });
  }, [dayQuery.data, selectedDate]);
  const markAllPresent = () =>
    setRecords(current => ({
      ...current,
      [selectedDate]: Object.fromEntries(
        attendanceRoster.map(employee => [employee.name, "Present"])
      ) as AttendanceRecord,
    }));
  const goPrevious = () => setSelectedDate(current => shiftDate(current, -1));
  const goNext = () =>
    setSelectedDate(current =>
      current < today ? shiftDate(current, 1) : current
    );

  const saveDay = () => {
    const rows = attendanceRoster.map(employee => ({
      employeeName: employee.name,
      status: record[employee.name] ?? "Present",
      checkIn: details[employee.name]?.checkIn ?? null,
      checkOut: details[employee.name]?.checkOut ?? null,
      note: details[employee.name]?.note?.trim() || null,
    }));
    const warnings = rows.filter(employee =>
      timeOrderWarning(
        details[employee.employeeName]?.checkIn,
        details[employee.employeeName]?.checkOut
      )
    ).length;
    void saveDayMutation
      .mutateAsync({ date: selectedDate, rows })
      .then(() => dayQuery.refetch())
      .then(() =>
        toast.success("Attendance saved", {
          description: `${rows.length} employees recorded for ${formatAttendanceDate(selectedDate)}.${warnings ? ` ${warnings} saved with time warnings.` : ""}`,
        })
      )
      .catch((caught: unknown) => {
        toast.error("Save failed", {
          description:
            caught instanceof Error ? caught.message : "Please try again.",
        });
      });
  };

  const exportDayCsv = () => {
    const header = ["Employee", "Role", "Department", "Status", "Check-in", "Check-out", "Note"];
    const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = attendanceRoster.map(employee => {
      const detail = details[employee.name] ?? {};
      return [
        employee.name,
        employee.role,
        employee.department ?? "",
        record[employee.name] ?? "Present",
        detail.checkIn ?? "",
        detail.checkOut ?? "",
        detail.note ?? "",
      ].map(cell).join(",");
    });
    const csv = [header.map(cell).join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `BOB-Attendance-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Daily report exported", {
      description: `Downloaded attendance CSV for ${formatAttendanceDate(selectedDate)}.`,
    });
  };

  const departmentsList = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(attendanceRoster.map(e => e.department).filter(Boolean))
      ),
    ],
    []
  );
  const filteredRoster = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return attendanceRoster.filter(employee => {
      const matchesDept =
        deptFilter === "All" || employee.department === deptFilter;
      const matchesQuery =
        !normalized ||
        [employee.name, employee.role, employee.department, record[employee.name]].some(v =>
          (v ?? "").toLowerCase().includes(normalized)
        );
      return matchesDept && matchesQuery;
    });
  }, [query, deptFilter]);

  const monthlyDays = useMemo(
    () => [
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
    ],
    []
  );
  const monthlySummaryRows = useMemo(
    () =>
      computeMonthlyAttendanceSummary(attendanceRoster, records, monthlyDays),
    [records, monthlyDays]
  );

  return (
    <div className="content">
      <PageHeading
        eyebrow="People operations"
        title="Attendance & August Summary"
        copy="Mark daily attendance, search imported roster records, filter by department, and review monthly days worked and absence reports."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`secondary-button ${viewMode === "daily" ? "selected" : ""}`}
              onClick={() => setViewMode("daily")}
            >
              Daily attendance
            </button>
            <button
              className={`secondary-button ${viewMode === "summary" ? "selected" : ""}`}
              onClick={() => setViewMode("summary")}
            >
              Monthly summary report
            </button>
            {viewMode === "daily" && (
              <button className="primary-button" onClick={markAllPresent}>
                <CheckCircle2 size={14} /> Mark all present
              </button>
            )}
            {viewMode === "daily" && (
              <button
                className="primary-button"
                onClick={saveDay}
                disabled={saveDayMutation.isPending}
              >
                <Save size={14} /> {saveDayMutation.isPending ? "Saving…" : "Save day"}
              </button>
            )}
            {viewMode === "daily" && (
              <button className="secondary-button" onClick={exportDayCsv}>
                <Download size={14} /> Export day (.csv)
              </button>
            )}
          </div>
        }
      />
      {viewMode === "daily" ? (
        <>
          <div className="attendance-toolbar panel">
            <div className="attendance-date-controls">
              <button
                className="icon-button attendance-nav"
                onClick={goPrevious}
                aria-label="Previous day"
              >
                <ArrowLeft size={15} />
              </button>
              <div>
                <div className="panel-title">
                  {formatAttendanceDate(selectedDate)}
                </div>
                <div className="panel-meta">
                  {selectedDate === today
                    ? "Today · editable attendance"
                    : "Historical record · editable review"}
                </div>
              </div>
              <button
                className="icon-button attendance-nav"
                onClick={goNext}
                disabled={selectedDate >= today}
                aria-label="Next day"
              >
                <ArrowRight size={15} />
              </button>
              {selectedDate !== today && (
                <button
                  className="secondary-button attendance-today"
                  onClick={() => setSelectedDate(today)}
                >
                  Today
                </button>
              )}
              <input
                type="date"
                className="mapping-select"
                aria-label="Choose attendance date"
                value={selectedDate}
                max={today}
                onChange={event => {
                  if (event.target.value) setSelectedDate(event.target.value);
                }}
              />
            </div>
            <StatusBadge
              value={selectedDate === today ? "Current day" : "History"}
            />
          </div>
          <div className="attendance-summary-grid">
            <MetricCard
              label="Marked"
              value={`${marked}%`}
              foot={`${attendanceRoster.length} employees`}
              icon={<ClipboardCheck size={13} />}
              tone="green"
            />
            <MetricCard
              label="Present"
              value={`${summary.Present}`}
              foot="On duty today"
              icon={<CheckCircle2 size={13} />}
              tone="green"
            />
            <MetricCard
              label="On leave"
              value={`${summary["On Leave"]}`}
              foot="Approved leave"
              icon={<CalendarDays size={13} />}
            />
            <MetricCard
              label="Assigned / off-site"
              value={`${summary.Assigned + summary["Off-Site"]}`}
              foot="Away from base"
              icon={<Users size={13} />}
            />
          </div>
          <div className="panel attendance-panel" style={{ marginTop: 16 }}>
            <div className="panel-header" style={{ flexWrap: "wrap", gap: 12 }}>
              <div>
                <div className="panel-title">Employee attendance roster</div>
                <div className="panel-meta">
                  Showing {filteredRoster.length} of {attendanceRoster.length}{" "}
                  employees for {formatAttendanceDate(selectedDate)}.
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div
                  className="search-pill"
                  style={{
                    width: 220,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    background: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: 6,
                  }}
                >
                  <Search size={14} color="#888" />
                  <input
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "inherit",
                      outline: "none",
                      width: "100%",
                      fontSize: 13,
                    }}
                    placeholder="Search name, role, dept..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                </div>
                <select
                  className="mapping-select"
                  style={{ width: 160 }}
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  aria-label="Filter roster by department"
                >
                  {departmentsList.map(dept => (
                    <option value={dept} key={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="panel-body">
              <div className="attendance-list">
                {filteredRoster.map((employee, employeeIndex) => {
                  const status = record[employee.name] ?? "Present";
                  const detail = details[employee.name] ?? {};
                  const warning = timeOrderWarning(detail.checkIn, detail.checkOut);
                  const expanded = expandedEmployee === employee.name;
                  return (
                    <div
                      className="attendance-row"
                      key={`${employee.department}-${employee.name}-${employeeIndex}`}
                    >
                      <div className="attendance-person">
                        <div className="avatar">{employee.initials}</div>
                        <div>
                          <div className="compliance-name">{employee.name}</div>
                          <div className="compliance-sub">
                            {employee.role} ·{" "}
                            <span style={{ color: "#4f9cf9" }}>
                              {employee.department}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="attendance-action">
                        <StatusBadge value={status} />
                        <select
                          className="attendance-select"
                          value={status}
                          onChange={event =>
                            updateStatus(
                              employee.name,
                              event.target.value as AttendanceStatus
                            )
                          }
                          aria-label={`Attendance for ${employee.name}`}
                        >
                          {ATTENDANCE_STATUSES.map(option => (
                            <option value={option} key={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="secondary-button"
                          aria-expanded={expanded}
                          aria-label={`Times and note for ${employee.name}`}
                          onClick={() =>
                            setExpandedEmployee(current =>
                              current === employee.name ? null : employee.name
                            )
                          }
                        >
                          <Clock3 size={13} /> {expanded ? "Hide" : "Times"}
                        </button>
                      </div>
                      {expanded && (
                        <div
                          className="detail-list"
                          style={{ gridColumn: "1 / -1", marginTop: 8 }}
                        >
                          <div className="detail-cell">
                            <label>Check-in</label>
                            <input
                              type="time"
                              aria-label={`Check-in for ${employee.name}`}
                              value={detail.checkIn ?? ""}
                              onChange={event =>
                                updateDetail(employee.name, {
                                  checkIn: event.target.value || undefined,
                                })
                              }
                              style={{ width: "100%" }}
                            />
                          </div>
                          <div className="detail-cell">
                            <label>Check-out</label>
                            <input
                              type="time"
                              aria-label={`Check-out for ${employee.name}`}
                              value={detail.checkOut ?? ""}
                              onChange={event =>
                                updateDetail(employee.name, {
                                  checkOut: event.target.value || undefined,
                                })
                              }
                              style={{ width: "100%" }}
                            />
                          </div>
                          <div className="detail-cell">
                            <label>Note</label>
                            <input
                              aria-label={`Note for ${employee.name}`}
                              placeholder="Shift note (optional)"
                              value={detail.note ?? ""}
                              onChange={event =>
                                updateDetail(employee.name, {
                                  note: event.target.value || undefined,
                                })
                              }
                              style={{ width: "100%" }}
                            />
                          </div>
                          {warning && (
                            <div className="detail-cell">
                              <label>Warning</label>
                              <div style={{ color: "#e31e24", fontSize: 12 }}>
                                <AlertTriangle
                                  size={12}
                                  style={{
                                    verticalAlign: "-2px",
                                    marginRight: 6,
                                  }}
                                />
                                {warning}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredRoster.length === 0 && (
                  <div className="empty-state">
                    No attendance records match this search or department
                    filter.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">
                August 2026 Attendance Summary Report
              </div>
              <div className="panel-meta">
                Aggregated days worked, absences, leave, and field duty for all
                imported employees.
              </div>
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                const sheet = XLSX.utils.json_to_sheet(monthlySummaryRows);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, sheet, "August Summary");
                XLSX.writeFile(
                  workbook,
                  "BOB-Cranes-August-2026-Attendance-Summary.xlsx"
                );
                toast.success("Monthly report exported", {
                  description: "Downloaded attendance summary spreadsheet.",
                });
              }}
            >
              <Download size={14} /> Export summary (.xlsx)
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Days Worked</th>
                  <th>Absences</th>
                  <th>On Leave</th>
                  <th>Assigned / Off-Site</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummaryRows.map((row, rowIndex) => {
                  const pct = Math.round(
                    (row.daysWorked / row.totalRecorded) * 100
                  );
                  return (
                    <tr key={`${row.department}-${row.name}-${rowIndex}`}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td>
                        <span className="status-badge gray">
                          {row.department}
                        </span>
                      </td>
                      <td className="muted">{row.role}</td>
                      <td>
                        <span style={{ color: "#31b56b", fontWeight: 600 }}>
                          {row.daysWorked} days
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            color: row.absences > 0 ? "#e31e24" : "inherit",
                          }}
                        >
                          {row.absences} days
                        </span>
                      </td>
                      <td>{row.daysOnLeave} days</td>
                      <td>{row.daysAssigned + row.daysOffSite} days</td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div className="progress-track" style={{ width: 80 }}>
                            <div
                              className="progress-fill green"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span style={{ fontSize: 11 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="attendance-note">
        <ShieldCheck size={15} />
        <span>
          Saving a day persists it to the database (one row per employee per
          day — re-marking updates). Check-out before check-in saves with a
          red warning. Export the day as CSV or the month as a spreadsheet.
        </span>
      </div>
    </div>
  );
}

type DepartmentPortalConfig = {
  label: string;
  focus: string;
  checklist: string[];
  entryStage: Stage;
  nextStage?: Stage;
  actionLabel: string;
  owner: string;
  parallelCode?: "maintenance" | "hse" | "accounts" | "hr" | "transportation";
  secondaryStage?: Stage;
  secondaryNextStage?: Stage;
  secondaryActionLabel?: string;
  readOnly?: boolean;
};

