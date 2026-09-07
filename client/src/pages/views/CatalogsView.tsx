import React, { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeading } from "./OverviewHelpers";
import { StatusBadge } from "./primitives";
import {
  DEPARTMENT_DASHBOARD_ACCENTS,
  DEPARTMENT_DASHBOARD_ICONS,
  DEPARTMENT_WORKSTREAMS,
} from "@shared/departmentDashboardRules";

type CatalogTab = "cranes" | "gears" | "trailers" | "departments";

/**
 * Admin → Catalogs (PRD v3.0 §7.3–7.4): equipment, lifting gear, trailer,
 * and department registries. Deleting an asset referenced by a booking
 * deactivates it instead of destroying history.
 */
export function CatalogsView() {
  const [tab, setTab] = useState<CatalogTab>("cranes");

  const fail = (caught: unknown) =>
    toast.error("Catalog update failed", {
      description: caught instanceof Error ? caught.message : "Please try again.",
    });

  return (
    <div className="content">
      <PageHeading
        eyebrow="Administration"
        title="Catalogs"
        copy="Master equipment, gear, trailer, and department registries. Referenced assets deactivate instead of deleting."
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }} role="tablist" aria-label="Catalog sections">
        {(
          [
            { id: "cranes", label: "Cranes" },
            { id: "gears", label: "Lifting Gears" },
            { id: "trailers", label: "Trailers" },
            { id: "departments", label: "Departments" },
          ] as Array<{ id: CatalogTab; label: string }>
        ).map(entry => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={`filter-chip ${tab === entry.id ? "selected" : ""}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {tab === "cranes" && <CraneTab onError={fail} />}
      {tab === "gears" && <GearTab onError={fail} />}
      {tab === "trailers" && <TrailerTab onError={fail} />}
      {tab === "departments" && <DepartmentTab onError={fail} />}
    </div>
  );
}

function useCatalogData() {
  const catalogQuery = trpc.operations.listEquipmentAdmin.useQuery(undefined, {});
  return catalogQuery;
}

function CraneTab({
  onError,
}: {
  onError: (caught: unknown) => void;
}) {
  const catalogQuery = useCatalogData();
  const createMutation = trpc.operations.createEquipmentAsset.useMutation();
  const updateMutation = trpc.operations.updateEquipmentAsset.useMutation();
  const deleteMutation = trpc.operations.deleteEquipmentAsset.useMutation();
  const [form, setForm] = useState({
    assetCode: "",
    name: "",
    capacityTons: "100",
    inspectionExpiry: "",
    type: "Mobile Crane",
    registration: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const cranes = catalogQuery.data?.cranes ?? [];

  const create = () => {
    if (!form.assetCode.trim() || !form.name.trim() || !form.inspectionExpiry.trim()) {
      toast.error("Asset code, name, and inspection expiry required");
      return;
    }
    void createMutation
      .mutateAsync({
        assetCode: form.assetCode.trim(),
        name: form.name.trim(),
        capacityTons: Number(form.capacityTons) || 50,
        inspectionExpiry: form.inspectionExpiry.trim(),
        type: form.type.trim() || "Mobile Crane",
        registration: form.registration.trim() || null,
      })
      .then(() => catalogQuery.refetch())
      .then(() => {
        setForm({ assetCode: "", name: "", capacityTons: "100", inspectionExpiry: "", type: "Mobile Crane", registration: "" });
        toast.success("Crane added to the catalog");
      })
      .catch(onError);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Cranes · {cranes.length} assets</div>
      </div>
      {catalogQuery.isLoading ? (
        <div className="panel-meta" style={{ padding: 12 }}>Loading catalog…</div>
      ) : (
        <div className="detail-list">
          {cranes.map(asset => (
            <div className="detail-cell" key={asset.id}>
              <label>
                {asset.assetCode} · {asset.capacityTons}T {asset.active !== 1 && "· Deactivated"}
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <span>{asset.name} · inspection {asset.inspectionExpiry}</span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <StatusBadge value={asset.active !== 1 ? "Deactivated" : asset.status} />
                  <button type="button" className="secondary-button" aria-label={`Edit ${asset.name}`} onClick={() => { setEditingId(asset.id); setEditStatus(asset.status); setEditExpiry(asset.inspectionExpiry); }}>
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    aria-label={`Delete ${asset.name}`}
                    disabled={deleteMutation.isPending}
                    onClick={() => void deleteMutation
                      .mutateAsync({ id: asset.id })
                      .then(result => catalogQuery.refetch().then(() => result))
                      .then(result => {
                        toast.success(result.deactivated ? "Asset deactivated" : "Asset deleted", {
                          description: result.deactivated ? "Referenced by a booking — history preserved." : undefined,
                        });
                      })
                      .catch(onError)}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
              {editingId === asset.id && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <input aria-label="Status" value={editStatus} onChange={event => setEditStatus(event.target.value)} placeholder="Status" style={{ flex: 1 }} />
                  <input aria-label="Inspection expiry" value={editExpiry} onChange={event => setEditExpiry(event.target.value)} placeholder="Inspection expiry" style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={updateMutation.isPending}
                    onClick={() => void updateMutation
                      .mutateAsync({ id: asset.id, status: editStatus.trim() || asset.status, inspectionExpiry: editExpiry.trim() || asset.inspectionExpiry })
                      .then(() => catalogQuery.refetch())
                      .then(() => {
                        setEditingId(null);
                        toast.success("Asset updated");
                      })
                      .catch(onError)}
                  >
                    <CheckCircle2 size={12} /> Save
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="detail-list" style={{ marginTop: 12 }}>
        <div className="detail-cell">
          <label>Asset code</label>
          <input aria-label="Asset code" value={form.assetCode} onChange={event => setForm(current => ({ ...current, assetCode: event.target.value }))} style={{ width: "100%" }} />
        </div>
        <div className="detail-cell">
          <label>Name</label>
          <input aria-label="Crane name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} style={{ width: "100%" }} />
        </div>
        <div className="detail-cell">
          <label>Capacity (tons)</label>
          <input aria-label="Capacity in tons" type="number" min={1} value={form.capacityTons} onChange={event => setForm(current => ({ ...current, capacityTons: event.target.value }))} style={{ width: "100%" }} />
        </div>
        <div className="detail-cell">
          <label>Inspection expiry</label>
          <input aria-label="Inspection expiry" value={form.inspectionExpiry} onChange={event => setForm(current => ({ ...current, inspectionExpiry: event.target.value }))} placeholder="2027-03-15" style={{ width: "100%" }} />
        </div>
      </div>
      <button type="button" className="primary-button" style={{ marginTop: 12 }} disabled={createMutation.isPending} onClick={create}>
        <Plus size={14} /> Add crane
      </button>
    </div>
  );
}

function GearTab({
  onError,
}: {
  onError: (caught: unknown) => void;
}) {
  const catalogQuery = useCatalogData();
  const createMutation = trpc.operations.createGearAsset.useMutation();
  const deleteMutation = trpc.operations.deleteGearAsset.useMutation();
  const [form, setForm] = useState({ name: "", gearType: "Shackle", swlTons: "10", inspectionExpiry: "" });
  const gears = catalogQuery.data?.gears ?? [];

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Lifting gears · {gears.length} items</div>
      </div>
      <div className="detail-list">
        {gears.map(gear => (
          <div className="detail-cell" key={gear.id}>
            <label>
              {gear.gearType} · {gear.swlTons}T SWL{gear.active !== 1 && " · Deactivated"}
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
              <span>{gear.name} · inspection {gear.inspectionExpiry}</span>
              <button
                type="button"
                className="secondary-button"
                aria-label={`Delete ${gear.name}`}
                disabled={deleteMutation.isPending}
                onClick={() => void deleteMutation
                  .mutateAsync({ id: gear.id })
                  .then(result => catalogQuery.refetch().then(() => result))
                  .then(result => {
                    toast.success(result.deactivated ? "Gear deactivated" : "Gear deleted", {
                      description: result.deactivated ? "Referenced by a booking — history preserved." : undefined,
                    });
                  })
                  .catch(onError)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="detail-list" style={{ marginTop: 12 }}>
        <div className="detail-cell">
          <label>Name</label>
          <input aria-label="Gear name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} style={{ width: "100%" }} />
        </div>
        <div className="detail-cell">
          <label>SWL (tons)</label>
          <input aria-label="Safe working load in tons" type="number" min={1} value={form.swlTons} onChange={event => setForm(current => ({ ...current, swlTons: event.target.value }))} style={{ width: "100%" }} />
        </div>
        <div className="detail-cell">
          <label>Inspection expiry</label>
          <input aria-label="Gear inspection expiry" value={form.inspectionExpiry} onChange={event => setForm(current => ({ ...current, inspectionExpiry: event.target.value }))} placeholder="2027-03-15" style={{ width: "100%" }} />
        </div>
      </div>
      <button
        type="button"
        className="primary-button"
        style={{ marginTop: 12 }}
        disabled={createMutation.isPending}
        onClick={() => {
          if (!form.name.trim() || !form.inspectionExpiry.trim()) {
            toast.error("Name and inspection expiry required");
            return;
          }
          void createMutation
            .mutateAsync({
              name: form.name.trim(),
              gearType: form.gearType,
              swlTons: Number(form.swlTons) || 10,
              inspectionExpiry: form.inspectionExpiry.trim(),
            })
            .then(() => catalogQuery.refetch())
            .then(() => {
              setForm({ name: "", gearType: "Shackle", swlTons: "10", inspectionExpiry: "" });
              toast.success("Gear added to the catalog");
            })
            .catch(onError);
        }}
      >
        <Plus size={14} /> Add gear
      </button>
    </div>
  );
}

function TrailerTab({
  onError,
}: {
  onError: (caught: unknown) => void;
}) {
  const catalogQuery = useCatalogData();
  const createMutation = trpc.operations.createTrailerAsset.useMutation();
  const deleteMutation = trpc.operations.deleteTrailerAsset.useMutation();
  const [plate, setPlate] = useState("");
  const [trailerType, setTrailerType] = useState("Flatbed");
  const trailers = catalogQuery.data?.trailers ?? [];

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Trailers · {trailers.length} units</div>
      </div>
      <div className="detail-list">
        {trailers.map(trailer => (
          <div className="detail-cell" key={trailer.id}>
            <label>
              {trailer.trailerType}
              {trailer.active !== 1 && " · Deactivated"}
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
              <span>
                {trailer.plateNumber} · <StatusBadge value={trailer.status} />
              </span>
              <button
                type="button"
                className="secondary-button"
                aria-label={`Delete ${trailer.plateNumber}`}
                disabled={deleteMutation.isPending}
                onClick={() => void deleteMutation
                  .mutateAsync({ id: trailer.id })
                  .then(result => catalogQuery.refetch().then(() => result))
                  .then(result => {
                    toast.success(result.deactivated ? "Trailer deactivated" : "Trailer deleted", {
                      description: result.deactivated ? "Referenced by a booking — history preserved." : undefined,
                    });
                  })
                  .catch(onError)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="detail-list" style={{ marginTop: 12 }}>
        <div className="detail-cell">
          <label>Plate number</label>
          <input aria-label="Plate number" value={plate} onChange={event => setPlate(event.target.value)} style={{ width: "100%" }} />
        </div>
        <div className="detail-cell">
          <label>Type</label>
          <input aria-label="Trailer type" value={trailerType} onChange={event => setTrailerType(event.target.value)} style={{ width: "100%" }} />
        </div>
      </div>
      <button
        type="button"
        className="primary-button"
        style={{ marginTop: 12 }}
        disabled={createMutation.isPending}
        onClick={() => {
          if (!plate.trim()) {
            toast.error("Plate number required");
            return;
          }
          void createMutation
            .mutateAsync({ plateNumber: plate.trim(), trailerType: trailerType.trim() || "Flatbed" })
            .then(() => catalogQuery.refetch())
            .then(() => {
              setPlate("");
              toast.success("Trailer added to the catalog");
            })
            .catch(onError);
        }}
      >
        <Plus size={14} /> Add trailer
      </button>
    </div>
  );
}

function DepartmentTab({
  onError,
}: {
  onError: (caught: unknown) => void;
}) {
  const departmentsQuery = trpc.departments.listProvisioned.useQuery(undefined, {});
  const createMutation = trpc.departments.createProvisioned.useMutation();
  const activeMutation = trpc.departments.setProvisionedActive.useMutation();
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    accent: "orange",
    icon: "LayoutDashboard",
    workstream: "operations",
  });
  const departments = departmentsQuery.data ?? [];

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Departments · {departments.length} workspaces</div>
        <div className="panel-meta">Archiving pauses sign-in without deleting history.</div>
      </div>
      {departmentsQuery.isLoading ? (
        <div className="panel-meta" style={{ padding: 12 }}>Loading departments…</div>
      ) : (
        <div className="detail-list">
          {departments.map(department => (
            <div className="detail-cell" key={department.code}>
              <label>{department.code}</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <span>{department.name}</span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <StatusBadge value={department.active === 1 ? "Active" : "Archived"} />
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={activeMutation.isPending}
                    onClick={() => void activeMutation
                      .mutateAsync({ code: department.code, active: department.active !== 1 })
                      .then(() => departmentsQuery.refetch())
                      .then(() => {
                        toast.success(department.active === 1 ? "Department archived" : "Department reactivated");
                      })
                      .catch(onError)}
                  >
                    {department.active === 1 ? "Archive" : "Reactivate"}
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="detail-list" style={{ marginTop: 12 }}>
        <div className="detail-cell">
          <label>Name</label>
          <input aria-label="Department name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} style={{ width: "100%" }} />
        </div>
        <div className="detail-cell">
          <label>Code (new, lowercase)</label>
          <input aria-label="Department code" value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value }))} style={{ width: "100%" }} />
        </div>
        <div className="detail-cell">
          <label>Description (min 12 chars)</label>
          <input aria-label="Department description" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} style={{ width: "100%" }} />
        </div>
        <div className="detail-cell">
          <label>Accent</label>
          <select aria-label="Accent" value={form.accent} onChange={event => setForm(current => ({ ...current, accent: event.target.value }))} style={{ width: "100%" }}>
            {DEPARTMENT_DASHBOARD_ACCENTS.map(accent => (
              <option key={accent} value={accent}>{accent}</option>
            ))}
          </select>
        </div>
        <div className="detail-cell">
          <label>Icon</label>
          <select aria-label="Icon" value={form.icon} onChange={event => setForm(current => ({ ...current, icon: event.target.value }))} style={{ width: "100%" }}>
            {DEPARTMENT_DASHBOARD_ICONS.map(icon => (
              <option key={icon} value={icon}>{icon}</option>
            ))}
          </select>
        </div>
        <div className="detail-cell">
          <label>Workstream</label>
          <select aria-label="Workstream" value={form.workstream} onChange={event => setForm(current => ({ ...current, workstream: event.target.value }))} style={{ width: "100%" }}>
            {DEPARTMENT_WORKSTREAMS.map(workstream => (
              <option key={workstream} value={workstream}>{workstream}</option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="button"
        className="primary-button"
        style={{ marginTop: 12 }}
        disabled={createMutation.isPending}
        onClick={() => void createMutation
          .mutateAsync({
            name: form.name.trim(),
            code: form.code.trim(),
            description: form.description.trim(),
            accent: form.accent as "orange" | "blue" | "green" | "violet",
            icon: form.icon as "LayoutDashboard" | "HardHat" | "ShieldCheck" | "Truck" | "Users" | "ClipboardCheck",
            workstream: form.workstream as "operations" | "compliance" | "commercial" | "support",
          })
          .then(() => departmentsQuery.refetch())
          .then(() => {
            setForm({ name: "", code: "", description: "", accent: "orange", icon: "LayoutDashboard", workstream: "operations" });
            toast.success("Department workspace created", {
              description: "Assign a supervisor to activate the team.",
            });
          })
          .catch(onError)}
      >
        <Plus size={14} /> Create department
      </button>
    </div>
  );
}
