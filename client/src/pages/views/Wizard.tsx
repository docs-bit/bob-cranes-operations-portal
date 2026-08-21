import React, { useState } from "react";
import { Check, CheckCircle2, ChevronDown, FolderOpen, Lock, Send, X, ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
import { departmentList, crews, gears, initials, type Booking } from "./shared";
import { PageHeading } from "./OverviewHelpers";
import { StatusBadge } from "./primitives";

export function Wizard({
  onCreated,
  onCancel,
}: {
  onCreated: (booking: Booking) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1);
  const [wizardToast, setWizardToast] = useState("");
  const [selectedCrane, setSelectedCrane] = useState(
    "200T Mobile Crane · B-205"
  );
  const [selectedCrew, setSelectedCrew] = useState([
    "Vineeth Vijayan",
    "Anoop Panikashery",
    "Vijayakumar",
    "Amal Krishnan",
  ]);
  const [selectedGear, setSelectedGear] = useState([
    "4-leg wire rope sling",
    "Bow shackle · 35T",
  ]);
  const [craneFilter, setCraneFilter] = useState<
    "capacity" | "available" | "fleet"
  >("capacity");
  const craneOptions = [
    {
      name: "200T Mobile Crane · B-205",
      type: "LTM 1200 · 200T capacity",
      status: "Available",
      cert: "Inspection valid · 15 Jan 2027",
    },
    {
      name: "250T Mobile Crane · B-213",
      type: "LTM 1250 · 250T capacity",
      status: "Assigned",
      cert: "Inspection valid · 06 Nov 2026",
    },
    {
      name: "350T Mobile Crane · B-217",
      type: "LTM 1350 · 350T capacity",
      status: "Available",
      cert: "Inspection valid · 23 Oct 2026",
    },
  ];
  const visibleCranes = craneOptions.filter(crane =>
    craneFilter === "capacity"
      ? Number.parseInt(crane.type, 10) >= 200
      : craneFilter === "available"
        ? crane.status === "Available"
        : crane.name.includes("B-")
  );
  const [form, setForm] = useState({
    client: "Gulf Contracting LLC",
    project: "Downtown Tower Lift",
    pm: "Rohan Mathew",
    lpo: "LPO-2026-0481",
    mob: "2026-08-11",
    offHire: "2026-08-18",
    contact: "Akhil Thomas",
    email: "operations@gulfcontracting.ae",
    phone: "+971 50 123 4418",
    priority: "Critical",
    docs: "Trade license, LPO, site access pass, method statement",
  });
  const update = (key: string, value: string) =>
    setForm(current => ({ ...current, [key]: value }));
  const next = () => {
    if (
      step === 1 &&
      (!form.client || !form.email || !form.mob || !form.offHire)
    ) {
      setWizardToast(
        "Complete client, email, and mobilization dates before continuing."
      );
      setTimeout(() => setWizardToast(""), 2600);
      return;
    }
    setStep(current => Math.min(6, current + 1));
  };
  const finish = () => {
    const booking: Booking = {
      id: `BOB Booking-${Math.floor(10000 + Math.random() * 89999)}`,
      client: form.client,
      project: form.project,
      crane: selectedCrane.split(" · ")[0],
      site: "Dubai Downtown",
      stage: "Created by Salesperson",
      priority: form.priority as Booking["priority"],
      progress: 0,
      mob: "11 Aug 2026",
      offHire: "18 Aug 2026",
      pm: form.pm,
      crew: `${selectedCrew.length} assigned`,
    };
    onCreated(booking);
  };
  return (
    <div className="content">
      <div className="wizard-shell">
        <PageHeading
          eyebrow="Sales intake · 6 steps"
          title="Create a new booking dossier"
          copy="Capture the client brief, allocate compliant resources, and broadcast the handoff to all eight departmentList."
          action={
            <button className="secondary-button" onClick={onCancel}>
              <X size={14} /> Cancel
            </button>
          }
        />
        <div className="wizard-steps">
          {[
            "Client & project",
            "Crane selection",
            "Broadcast",
            "Crew assignment",
            "Lifting gears",
            "Review & create",
          ].map((label, index) => (
            <div
              key={label}
              className={`wizard-step ${step === index + 1 ? "active" : step > index + 1 ? "done" : ""}`}
            >
              <div className="wizard-index">
                {step > index + 1 ? <Check size={12} /> : `0${index + 1}`}
              </div>
              {label}
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">
                Step {step} ·{" "}
                {
                  [
                    "Client & project dossier",
                    "Crane selection",
                    "System broadcast",
                    "Crew assignment",
                    "Lifting gears",
                    "Review & create",
                  ][step - 1]
                }
              </div>
              <div className="panel-meta">
                {step === 1
                  ? "The notification email is locked once the booking is confirmed."
                  : "Only compliant resources can be attached to a confirmed dossier."}
              </div>
            </div>
            <StatusBadge value={form.priority} />
          </div>
          <div className="panel-body">
            {step === 1 && (
              <div className="form-grid">
                <div className="form-field">
                  <label>Client name *</label>
                  <input
                    className="form-input"
                    value={form.client}
                    onChange={event => update("client", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Project / scope *</label>
                  <input
                    className="form-input"
                    value={form.project}
                    onChange={event => update("project", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Project Manager</label>
                  <input
                    className="form-input"
                    value={form.pm}
                    onChange={event => update("pm", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>LPO reference</label>
                  <input
                    className="form-input"
                    value={form.lpo}
                    onChange={event => update("lpo", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Mobilization date *</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.mob}
                    onChange={event => update("mob", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Off-hire date *</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.offHire}
                    onChange={event => update("offHire", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Client contact person</label>
                  <input
                    className="form-input"
                    value={form.contact}
                    onChange={event => update("contact", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Client contact number</label>
                  <input
                    className="form-input"
                    value={form.phone}
                    onChange={event => update("phone", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Client notification email *</label>
                  <input
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={event => update("email", event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Priority tier</label>
                  <select
                    className="form-select"
                    value={form.priority}
                    onChange={event => update("priority", event.target.value)}
                  >
                    <option>Standard</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
                <div className="form-field wide">
                  <label>Required documents checklist</label>
                  <textarea
                    className="form-textarea"
                    value={form.docs}
                    onChange={event => update("docs", event.target.value)}
                  />
                </div>
              </div>
            )}
            {step === 2 && (
              <div>
                <div className="filter-row" style={{ marginBottom: 15 }}>
                  <button
                    className={`filter-chip ${craneFilter === "capacity" ? "selected" : ""}`}
                    onClick={() => setCraneFilter("capacity")}
                    aria-pressed={craneFilter === "capacity"}
                  >
                    200T + capacity
                  </button>
                  <button
                    className={`filter-chip ${craneFilter === "available" ? "selected" : ""}`}
                    onClick={() => setCraneFilter("available")}
                    aria-pressed={craneFilter === "available"}
                  >
                    Available now
                  </button>
                  <button
                    className={`filter-chip ${craneFilter === "fleet" ? "selected" : ""}`}
                    onClick={() => setCraneFilter("fleet")}
                    aria-pressed={craneFilter === "fleet"}
                  >
                    Dubai fleet
                  </button>
                </div>
                <div className="resource-grid">
                  {visibleCranes.map(crane => (
                    <div
                      className={`resource-card ${selectedCrane === crane.name ? "selected" : ""}`}
                      key={crane.name}
                      onClick={() =>
                        crane.status === "Available" &&
                        setSelectedCrane(crane.name)
                      }
                    >
                      <div className="resource-top">
                        <div>
                          <div className="resource-name">{crane.name}</div>
                          <div className="resource-sub">
                            {crane.type}
                            <br />
                            {crane.cert}
                          </div>
                        </div>
                        <StatusBadge value={crane.status} />
                      </div>
                      <div className="resource-action">
                        {selectedCrane === crane.name ? (
                          <StatusBadge value="Selected" />
                        ) : (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={crane.status !== "Available"}
                            onClick={event => {
                              event.stopPropagation();
                              if (crane.status === "Available")
                                setSelectedCrane(crane.name);
                            }}
                          >
                            Select crane
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="empty-state">
                <div className="brand-mark" style={{ margin: "0 auto 14px" }}>
                  <Send size={18} />
                </div>
                <h3 style={{ margin: 0, color: "#fff" }}>
                  Broadcast ready to send
                </h3>
                <p style={{ maxWidth: 520, margin: "8px auto 18px" }}>
                  On confirmation, the system posts a dashboard card and Team
                  Comms message to all eight departmentList at the same time.
                </p>
                <div
                  className="filter-row"
                  style={{ justifyContent: "center" }}
                >
                  {departmentList.map(([name]) => (
                    <span className="status-badge gray" key={name}>
                      <Check size={10} />
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {step === 4 && (
              <div>
                <div className="panel-meta" style={{ marginBottom: 12 }}>
                  Required roster: 2 operators · 2 riggers · 1 supervisor · 1
                  banksman
                </div>
                <div className="resource-grid">
                  {crews.map((crew, crewIndex) => (
                    <div
                      key={`${crew.name}-${crew.role}-${crewIndex}`}
                      className={`resource-card ${selectedCrew.includes(crew.name) ? "selected" : ""} ${crew.availability !== "Present" && crew.availability !== "Assigned" ? "blocked" : ""}`}
                      onClick={() => {
                        if (
                          crew.availability === "Present" ||
                          crew.availability === "Assigned"
                        )
                          setSelectedCrew(current =>
                            current.includes(crew.name)
                              ? current.filter(name => name !== crew.name)
                              : [...current, crew.name]
                          );
                      }}
                    >
                      <div className="resource-top">
                        <div style={{ display: "flex", gap: 9 }}>
                          <div className="avatar">{crew.initials}</div>
                          <div>
                            <div className="resource-name">{crew.name}</div>
                            <div className="resource-sub">
                              {crew.role}
                              <br />
                              {crew.cert}
                            </div>
                          </div>
                        </div>
                        <StatusBadge value={crew.availability} />
                      </div>
                      <div className="resource-action">
                        {crew.flag ? (
                          <StatusBadge value="Training required" />
                        ) : selectedCrew.includes(crew.name) ? (
                          <StatusBadge value="Selected" />
                        ) : (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={event => {
                              event.stopPropagation();
                              setSelectedCrew(current =>
                                current.includes(crew.name)
                                  ? current.filter(name => name !== crew.name)
                                  : [...current, crew.name]
                              );
                            }}
                          >
                            Select
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {step === 5 && (
              <div>
                <div className="panel-meta" style={{ marginBottom: 12 }}>
                  Inspection certificates are checked against the mobilization
                  date. Expired gear cannot be selected.
                </div>
                <div className="resource-grid">
                  {gears.map(gear => (
                    <div
                      key={gear.name}
                      className={`resource-card ${selectedGear.includes(gear.name) ? "selected" : ""} ${gear.status === "Expired" ? "blocked" : ""}`}
                      onClick={() =>
                        gear.status !== "Expired" &&
                        setSelectedGear(current =>
                          current.includes(gear.name)
                            ? current.filter(name => name !== gear.name)
                            : [...current, gear.name]
                        )
                      }
                    >
                      <div className="resource-top">
                        <div>
                          <div className="resource-name">{gear.name}</div>
                          <div className="resource-sub">
                            {gear.type}
                            <br />
                            Certificate {gear.cert}
                            <br />
                            Valid through {gear.expires}
                          </div>
                        </div>
                        {gear.status === "Expired" ? (
                          <Lock size={15} color="#e31e24" />
                        ) : (
                          <StatusBadge value={gear.status} />
                        )}
                      </div>
                      <div className="resource-action">
                        {gear.status === "Expired" ? (
                          <span className="status-badge red">
                            <Lock size={9} />
                            Selection blocked
                          </span>
                        ) : selectedGear.includes(gear.name) ? (
                          <StatusBadge value="Selected" />
                        ) : (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={event => {
                              event.stopPropagation();
                              setSelectedGear(current =>
                                current.includes(gear.name)
                                  ? current.filter(name => name !== gear.name)
                                  : [...current, gear.name]
                              );
                            }}
                          >
                            Select gear
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {step === 6 && (
              <div>
                <div className="detail-list">
                  <div className="detail-cell">
                    <label>Generated dossier ID</label>
                    <div>BOB Booking-XXXXX</div>
                  </div>
                  <div className="detail-cell">
                    <label>Notification email</label>
                    <div>{form.email}</div>
                  </div>
                  <div className="detail-cell">
                    <label>Client / project</label>
                    <div>
                      {form.client} · {form.project}
                    </div>
                  </div>
                  <div className="detail-cell">
                    <label>Crane</label>
                    <div>{selectedCrane}</div>
                  </div>
                  <div className="detail-cell">
                    <label>Crew</label>
                    <div>{selectedCrew.length} selected</div>
                  </div>
                  <div className="detail-cell">
                    <label>Lifting gear</label>
                    <div>{selectedGear.length} compliant items</div>
                  </div>
                </div>
                <div className="notification" style={{ marginTop: 16 }}>
                  <div className="title">
                    <FolderOpen
                      size={14}
                      style={{ verticalAlign: "-2px", marginRight: 6 }}
                    />
                    Google Drive folder will be generated on confirmation
                  </div>
                  <div className="body">
                    Bk {form.client}-Dubai Downtown-11.08.2026
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="wizard-actions">
            <button
              className="secondary-button"
              onClick={() =>
                step === 1 ? onCancel() : setStep(current => current - 1)
              }
            >
              <ArrowLeft size={14} /> Back
            </button>
            {step < 6 ? (
              <button className="primary-button" onClick={next}>
                Continue <ArrowRight size={14} />
              </button>
            ) : (
              <button className="primary-button" onClick={finish}>
                <CheckCircle2 size={15} /> Confirm booking
              </button>
            )}
          </div>
        </div>
        {wizardToast && (
          <div className="toast-note">
            <AlertTriangle
              size={14}
              style={{ verticalAlign: "-2px", marginRight: 7 }}
            />
            {wizardToast}
          </div>
        )}
      </div>
    </div>
  );
}

