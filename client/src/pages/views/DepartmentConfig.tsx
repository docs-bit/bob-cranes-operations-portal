import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Download, Filter, FolderOpen, LayoutDashboard, Lock, Plus, Search, ShieldCheck, Truck, Users, Wrench, X } from "lucide-react";
import { DEPARTMENTS, type Booking } from "./shared";
import { StatusBadge } from "./primitives";
import { canDispatch as canDispatchByRule, departmentCompletion, documentCompletion, type DocumentItem } from "@shared/bookingRules";
import { DEPARTMENT_LABEL_TO_CODE, canAccessWorkspaceView } from "@shared/departmentAccess";
import { normalizeDepartmentDashboardConfig, defaultWorkflowChecklist, DEPARTMENT_DASHBOARD_METRICS, DEPARTMENT_DASHBOARD_WIDGETS, type DepartmentDashboardConfig, type DepartmentDashboardMetric, type DepartmentDashboardWidget, type WorkflowChecklistItem } from "@shared/departmentDashboardRules";
import { ATTENDANCE_CREW_ROSTER } from "@shared/attendanceCrewRoster";
import { VEHICLE_FLEET } from "@shared/vehicleFleetData";
import { filterVehicleFleet, vehicleRegistrationStatus, type VehicleRegistrationStatus } from "@shared/vehicleFleetRules";
import { trpc } from "@/lib/trpc";

export const PARALLEL_WORKSTREAMS = ["maintenance", "hse", "accounts", "hr", "transportation"] as const;

export type DepartmentPortalConfig = Record<string, any>;

export const departmentPortalConfigs: Record<string, DepartmentPortalConfig> = {
  sales: {
    label: "Sales & Client Relations",
    focus:
      "Client intake, LPO verification, response portal setup, and dispatch review.",
    checklist: [
      "Confirm client and project details",
      "Verify LPO and locked notification email",
      "Generate BOB Booking dossier and notify departments",
    ],
    entryStage: "Created by Salesperson",
    nextStage: "Documentation Supervisor",
    actionLabel: "Confirm booking",
    owner: "Salesperson",
    secondaryStage: "Reviewed",
    secondaryNextStage: "Dispatched",
    secondaryActionLabel: "Dispatch approved dossier",
  },
  documentation: {
    label: "Documentation & Permits",
    focus:
      "Dossier control, permit packs, additional requirements, and revision queues.",
    checklist: [
      "Review client requirements",
      "Assign crane, crew, and lifting gear evidence",
      "Submit completed documentation pack",
    ],
    entryStage: "Documentation Supervisor",
    nextStage: "Crew Assigned",
    actionLabel: "Assign resources",
    owner: "Documentation Supervisor",
    secondaryStage: "Docs In Progress",
    secondaryNextStage: "All Docs Submitted",
    secondaryActionLabel: "Submit all documents",
  },
  "lifting-gears": {
    label: "Lifting Gears / Engineering",
    focus:
      "Inspection certificates, expiry hard-blocks, and gear confirmation.",
    checklist: [
      "Check shackles, slings, beams, and hooks",
      "Reject expired inspection certificates",
      "Confirm compliant gear for the dossier",
    ],
    entryStage: "Gear Confirmed",
    nextStage: "Docs In Progress",
    actionLabel: "Confirm gear readiness",
    owner: "Lifting Gears Supervisor",
  },
  maintenance: {
    label: "Maintenance",
    focus:
      "Crane readiness, maintenance holds, and equipment release controls.",
    checklist: [
      "Review crane maintenance status",
      "Resolve service or defect holds",
      "Release equipment to operations",
    ],
    entryStage: "Crew Assigned",
    actionLabel: "Mark equipment ready",
    owner: "Maintenance Supervisor",
    parallelCode: "maintenance",
  },
  crew: {
    label: "Crew / Workmen Assignment",
    focus:
      "Availability, certificates, role fit, and site-specific training validation.",
    checklist: [
      "Check Present / On Leave / Assigned / Off-Site status",
      "Validate operator, rigger, supervisor, and banksman certificates",
      "Assign compliant crew to the dossier",
    ],
    entryStage: "Crew Assigned",
    nextStage: "Gear Confirmed",
    actionLabel: "Confirm crew",
    owner: "Crew Supervisor",
  },
  hse: {
    label: "HSE / Safety",
    focus: "Lift plans, risk controls, training flags, and safety approvals.",
    checklist: [
      "Review method statement and lift plan",
      "Check site-required certifications and training",
      "Approve safety workstream",
    ],
    entryStage: "Docs In Progress",
    actionLabel: "Approve HSE workstream",
    owner: "HSE Supervisor",
    parallelCode: "hse",
  },
  accounts: {
    label: "Accounts",
    focus:
      "Commercial documents, LPO evidence, invoice controls, and release checks.",
    checklist: [
      "Validate LPO and commercial documents",
      "Match locked client notification email",
      "Clear accounts workstream",
    ],
    entryStage: "Docs In Progress",
    actionLabel: "Clear accounts",
    owner: "Accounts Supervisor",
    parallelCode: "accounts",
  },
  hr: {
    label: "HR",
    focus:
      "Attendance, roster integrity, training renewals, and workforce readiness.",
    checklist: [
      "Review attendance for the mobilization date",
      "Track training and certification renewals",
      "Confirm workforce readiness",
    ],
    entryStage: "Crew Assigned",
    actionLabel: "Confirm workforce",
    owner: "HR Supervisor",
    parallelCode: "hr",
  },
  transportation: {
    label: "Transportation",
    focus: "Trailers, delivery notes, route readiness, and site movement.",
    checklist: [
      "Assign trailers and delivery resources",
      "Validate delivery note requirements",
      "Confirm transport readiness",
    ],
    entryStage: "Docs In Progress",
    actionLabel: "Confirm transport",
    owner: "Transportation Supervisor",
    parallelCode: "transportation",
  },
  administrator: {
    label: "Administrator / Super Admin",
    focus:
      "Cross-department oversight, account governance, audit evidence, and workflow control.",
    checklist: [
      "Review lifecycle health across all departments",
      "Assign supervisors and unique credentials",
      "Monitor audit log and access status",
    ],
    entryStage: "Created by Salesperson",
    actionLabel: "Review control center",
    owner: "Administrator",
    readOnly: true,
  },
};

export function TransportationFleetPanel() {
  const [search, setSearch] = useState("");
  const [fleetType, setFleetType] = useState("All");
  const [registrationFilter, setRegistrationFilter] = useState<
    VehicleRegistrationStatus | "All"
  >("All");
  const [page, setPage] = useState(1);
  const pageSize = 40;
  const vehicleTypes = useMemo(
    () =>
      Array.from(
        new Set(VEHICLE_FLEET.map(vehicle => vehicle.fleetName))
      ).sort(),
    []
  );
  const filteredVehicles = useMemo(
    () =>
      filterVehicleFleet(VEHICLE_FLEET, search, fleetType, registrationFilter),
    [search, fleetType, registrationFilter]
  );
  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleVehicles = filteredVehicles.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const resetPage = (update: () => void) => {
    update();
    setPage(1);
  };
  const exportFleet = () => {
    const rows = filteredVehicles.map(vehicle => ({
      "Fleet code": vehicle.fleetCode,
      "Registration number": vehicle.registrationNumber,
      "Fleet name": vehicle.fleetName,
      "Vehicle model": vehicle.vehicleModel,
      "Chassis number": vehicle.chassisNumber,
      "Plate type": vehicle.plateType,
      Colour: vehicle.colour,
      "Year of manufacture": vehicle.yearOfManufacture,
      "Mulkiya expiry": vehicle.mulkiyaExpiry,
      "Registration status": vehicleRegistrationStatus(vehicle.mulkiyaExpiry),
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transportation Fleet");
    XLSX.writeFile(workbook, "BOB-Transportation-Fleet.xlsx");
    toast.success("Transportation fleet export prepared", {
      description: `${rows.length} vehicle records included.`,
    });
  };
  return (
    <div className="panel" data-testid="transportation-fleet">
      <div className="panel-header">
        <div>
          <div className="panel-title">Vehicle fleet register</div>
          <div className="panel-meta">
            {VEHICLE_FLEET.length} workbook records · Mulkiya validity is
            monitored for every listed vehicle.
          </div>
        </div>
        <button className="secondary-button" onClick={exportFleet}>
          <Download size={14} /> Export fleet (.xlsx)
        </button>
      </div>
      <div className="panel-body">
        <div className="filter-row" style={{ marginBottom: 14 }}>
          <input
            aria-label="Search transportation vehicles"
            className="form-input"
            style={{ minWidth: 230 }}
            placeholder="Search fleet code, plate, model, or chassis"
            value={search}
            onChange={event => resetPage(() => setSearch(event.target.value))}
          />
          <select
            aria-label="Filter fleet by vehicle type"
            className="form-select"
            value={fleetType}
            onChange={event =>
              resetPage(() => setFleetType(event.target.value))
            }
          >
            <option value="All">All vehicle types</option>
            {vehicleTypes.map(type => (
              <option value={type} key={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter fleet by registration status"
            className="form-select"
            value={registrationFilter}
            onChange={event =>
              resetPage(() =>
                setRegistrationFilter(
                  event.target.value as VehicleRegistrationStatus | "All"
                )
              )
            }
          >
            <option value="All">All registration states</option>
            <option value="Valid">Valid</option>
            <option value="Expiring soon">Expiring soon</option>
            <option value="Expired">Expired</option>
            <option value="Unknown">Unknown</option>
          </select>
          <span className="status-badge blue">
            {filteredVehicles.length} matching
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Fleet code</th>
                <th>Registration</th>
                <th>Vehicle</th>
                <th>Model</th>
                <th>Year</th>
                <th>Mulkiya expiry</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleVehicles.map(vehicle => (
                <tr key={vehicle.id}>
                  <td>
                    <strong>{vehicle.fleetCode}</strong>
                  </td>
                  <td>{vehicle.registrationNumber}</td>
                  <td>{vehicle.fleetName}</td>
                  <td title={vehicle.chassisNumber}>{vehicle.vehicleModel}</td>
                  <td>{vehicle.yearOfManufacture || "—"}</td>
                  <td>{vehicle.mulkiyaExpiry || "Not recorded"}</td>
                  <td>
                    <StatusBadge
                      value={vehicleRegistrationStatus(vehicle.mulkiyaExpiry)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span>
            Showing{" "}
            {(currentPage - 1) * pageSize + (visibleVehicles.length ? 1 : 0)}–
            {(currentPage - 1) * pageSize + visibleVehicles.length} of{" "}
            {filteredVehicles.length} vehicles
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="secondary-button compact-button"
              disabled={currentPage === 1}
              onClick={() => setPage(value => Math.max(1, value - 1))}
            >
              Previous
            </button>
            <button
              className="secondary-button compact-button"
              disabled={currentPage === totalPages}
              onClick={() => setPage(value => Math.min(totalPages, value + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

