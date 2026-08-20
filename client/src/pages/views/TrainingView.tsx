import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileText, FolderOpen, Lock, Search, Users } from "lucide-react";
import { initials, TRAINING_EMPLOYEES, TRAINING_SOURCE_FILE, type TrainingStatus, type TrainingWorkstream } from "./shared";
import { PageHeading } from "./OverviewHelpers";
import { MetricCard, StatusBadge } from "./primitives";

export function TrainingView({
  selectedEmployeeId,
}: {
  selectedEmployeeId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [workstream, setWorkstream] = useState<"All" | TrainingWorkstream>(
    "All"
  );
  const [status, setStatus] = useState<"All" | TrainingStatus>("All");
  const [selectedId, setSelectedId] = useState(
    selectedEmployeeId ?? TRAINING_EMPLOYEES[0]?.employeeId ?? ""
  );
  useEffect(() => {
    if (selectedEmployeeId) setSelectedId(selectedEmployeeId);
  }, [selectedEmployeeId]);
  const filtered = useMemo(
    () =>
      TRAINING_EMPLOYEES.filter(employee => {
        const matchesQuery =
          !query.trim() ||
          `${employee.employeeName} ${employee.employeeId} ${employee.position} ${JSON.stringify(employee.certifications)}`
            .toLowerCase()
            .includes(query.trim().toLowerCase());
        const certifications = employee.certifications;
        const matchesWorkstream =
          workstream === "All" ||
          certifications.some(item => item.workstream === workstream);
        const matchesStatus =
          status === "All" ||
          certifications.some(item => item.status === status);
        return matchesQuery && matchesWorkstream && matchesStatus;
      }),
    [query, status, workstream]
  );
  const selected =
    filtered.find(employee => employee.employeeId === selectedId) ??
    filtered[0] ??
    null;
  const totals = useMemo(
    () =>
      TRAINING_EMPLOYEES.reduce(
        (summary, employee) =>
          employee.certifications.reduce(
            (current, item) => ({
              ...current,
              total: current.total + 1,
              recorded: current.recorded + (item.status === "Recorded" ? 1 : 0),
              missing: current.missing + (item.status === "Missing" ? 1 : 0),
              processing:
                current.processing + (item.status === "Processing" ? 1 : 0),
            }),
            summary
          ),
        { total: 0, recorded: 0, missing: 0, processing: 0 }
      ),
    []
  );
  return (
    <div className="content">
      <PageHeading
        eyebrow="People operations · imported register"
        title="Training register"
        copy={`Current onshore and offshore training details imported from ${TRAINING_SOURCE_FILE}. Search employees, filter readiness, and inspect each certificate value.`}
        action={
          <button
            className="secondary-button"
            onClick={() =>
              toast.info("Training source", {
                description: `${TRAINING_EMPLOYEES.length} employees and ${totals.total} certificate entries imported from ${TRAINING_SOURCE_FILE}.`,
              })
            }
          >
            <FileText size={14} /> Source details
          </button>
        }
      />
      <div className="metric-grid">
        <MetricCard
          label="Employees tracked"
          value={`${TRAINING_EMPLOYEES.length}`}
          foot="From source workbook"
          icon={<Users size={13} />}
          tone="green"
        />
        <MetricCard
          label="Recorded"
          value={`${totals.recorded}`}
          foot="Certificate values present"
          icon={<CheckCircle2 size={13} />}
          tone="green"
        />
        <MetricCard
          label="Missing"
          value={`${totals.missing}`}
          foot="Requires follow-up"
          icon={<AlertTriangle size={13} />}
        />
        <MetricCard
          label="Processing"
          value={`${totals.processing}`}
          foot="Pending confirmation"
          icon={<Clock3 size={13} />}
        />
      </div>
      <div className="training-toolbar panel">
        <div className="search-pill training-search">
          <Search size={14} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search employee, ID, or position"
            aria-label="Search training employees"
          />
        </div>
        <div className="filter-row">
          <button
            className={`filter-chip ${workstream === "All" ? "selected" : ""}`}
            onClick={() => setWorkstream("All")}
          >
            All workstreams
          </button>
          <button
            className={`filter-chip ${workstream === "Onshore" ? "selected" : ""}`}
            onClick={() => setWorkstream("Onshore")}
          >
            Onshore
          </button>
          <button
            className={`filter-chip ${workstream === "Offshore" ? "selected" : ""}`}
            onClick={() => setWorkstream("Offshore")}
          >
            Offshore
          </button>
        </div>
        <div className="filter-row">
          <button
            className={`filter-chip ${status === "All" ? "selected" : ""}`}
            onClick={() => setStatus("All")}
          >
            All statuses
          </button>
          <button
            className={`filter-chip ${status === "Missing" ? "selected" : ""}`}
            onClick={() => setStatus("Missing")}
          >
            Missing
          </button>
          <button
            className={`filter-chip ${status === "Processing" ? "selected" : ""}`}
            onClick={() => setStatus("Processing")}
          >
            Processing
          </button>
        </div>
      </div>
      <div className="training-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Employees</div>
              <div className="panel-meta">
                {filtered.length} matching source records
              </div>
            </div>
            <StatusBadge
              value={workstream === "All" ? "Onshore + Offshore" : workstream}
            />
          </div>
          <div className="panel-body training-employee-list">
            {filtered.slice(0, 80).map(employee => {
              const missing = employee.certifications.filter(
                item => item.status === "Missing"
              ).length;
              const recorded = employee.certifications.filter(
                item => item.status === "Recorded"
              ).length;
              return (
                <button
                  className={`training-employee-row ${selected?.employeeId === employee.employeeId ? "selected" : ""}`}
                  key={employee.employeeId}
                  onClick={() => setSelectedId(employee.employeeId)}
                >
                  <div className="avatar">
                    {initials(employee.employeeName)}
                  </div>
                  <div className="training-employee-copy">
                    <strong>{employee.employeeName}</strong>
                    <span>
                      {employee.employeeId} · {employee.position}
                    </span>
                    <small>
                      {recorded} recorded · {missing} missing
                    </small>
                  </div>
                  <ArrowRight size={14} />
                </button>
              );
            })}
            {filtered.length > 80 && (
              <div className="empty-state">
                Showing the first 80 matches. Refine the search to inspect more
                employees.
              </div>
            )}
            {filtered.length === 0 && (
              <div className="empty-state">
                No training records match these filters.
              </div>
            )}
          </div>
        </div>
        <div className="panel training-detail-panel">
          {selected ? (
            <>
              <div className="panel-header">
                <div>
                  <div className="panel-title">{selected.employeeName}</div>
                  <div className="panel-meta">
                    {selected.employeeId} · {selected.position}
                  </div>
                </div>
                <StatusBadge
                  value={`${selected.certifications.filter(item => item.status === "Recorded").length}/${selected.certifications.length} recorded`}
                />
              </div>
              <div className="panel-body">
                <div className="training-source-line">
                  <FileText size={14} />
                  <span>Source sheets: {selected.sourceSheets.join(", ")}</span>
                </div>
                <div className="training-cert-list">
                  {selected.certifications.map((item, index) => (
                    <div
                      className="training-cert-row"
                      key={`${selected.employeeId}-${item.training}-${index}`}
                    >
                      <div>
                        <strong>{item.training}</strong>
                        <span>
                          {item.workstream} · {item.value}
                        </span>
                      </div>
                      <StatusBadge value={item.status} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              Select an employee to inspect training details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

