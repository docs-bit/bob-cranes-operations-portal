import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, FileText, Lock, Plus, Truck, Upload, Users, Wrench, X } from "lucide-react";
import { gears, type GearRecord } from "./shared";

export { gears };
import { PageHeading } from "./OverviewHelpers";
import { MetricCard, StatusBadge } from "./primitives";
import { formatGearValidityDate, gearDocumentStatus, isValidGearDocumentPeriod } from "@shared/gearDocumentRules";
import { trpc } from "@/lib/trpc";

export function GearView() {
  const [filter, setFilter] = useState<
    "all" | "available" | "watch" | "blocked"
  >("all");
  const [addGearOpen, setAddGearOpen] = useState(false);
  const [certificateGear, setCertificateGear] = useState<GearRecord | null>(
    null
  );
  const [allGears, setAllGears] = useState(() =>
    gears.concat([
      {
        name: "Chain sling · 12T",
        type: "Slings · Grade 80",
        cert: "INS-2026-118",
        expires: "26 Aug 2026",
        status: "Compliant" as const,
        selected: false,
      },
    ])
  );
  const visibleGears = allGears.filter(
    gear =>
      filter === "all" ||
      (filter === "available"
        ? gear.status === "Compliant"
        : filter === "blocked"
          ? gear.status === "Expired"
          : gear.expires.includes("2026") && gear.status === "Compliant")
  );
  const filterLabels: Array<[typeof filter, string]> = [
    ["all", "All equipment"],
    ["available", "Available"],
    ["watch", "Inspection watch"],
    ["blocked", "Blocked"],
  ];
  return (
    <>
      <div className="content">
        <PageHeading
          eyebrow="Engineering compliance"
          title="Lifting gear inventory"
          copy="Upload the inspection record and validity period with every new asset. Expired documents stay visible for traceability but hard-block the gear from booking selection."
          action={
            <button
              className="primary-button"
              onClick={() => setAddGearOpen(true)}
            >
              <Plus size={15} /> Add gear
            </button>
          }
        />
        <div className="metric-grid">
          <MetricCard
            label="Gear assets"
            value="124"
            foot="92 currently available"
            icon={<Wrench size={13} />}
          />
          <MetricCard
            label="On-hire"
            value="32"
            foot="Across 14 bookings"
            icon={<Truck size={13} />}
          />
          <MetricCard
            label="Inspection watch"
            value="08"
            foot="Due within 20 days"
            icon={<AlertTriangle size={13} />}
          />
          <MetricCard
            label="Expired"
            value="02"
            foot="Hard-blocked from selection"
            icon={<Lock size={13} />}
          />
        </div>
        <div className="panel">
          <div className="panel-header">
            <div className="filter-row">
              {filterLabels.map(([value, label]) => (
                <button
                  key={value}
                  className={`filter-chip ${filter === value ? "selected" : ""}`}
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="panel-meta">
              {visibleGears.length} assets shown · certificate documents and
              validity dates tracked
            </div>
          </div>
          <div className="panel-body">
            <div className="resource-grid">
              {visibleGears.map(gear => {
                const documentCount = gear.documents?.length ?? 0;
                return (
                  <div
                    className={`resource-card ${gear.status === "Expired" ? "blocked" : ""}`}
                    key={gear.name}
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
                          {gear.validFrom && gear.validUntil ? (
                            <>
                              <br />
                              Validity {formatGearValidityDate(
                                gear.validFrom
                              )}{" "}
                              – {formatGearValidityDate(gear.validUntil)}
                            </>
                          ) : null}
                          <br />
                          {documentCount
                            ? `${documentCount} uploaded inspection document${documentCount === 1 ? "" : "s"}`
                            : "Legacy inspection record"}
                        </div>
                      </div>
                      {gear.status === "Expired" ? (
                        <Lock size={16} color="#e31e24" />
                      ) : (
                        <StatusBadge value={gear.status} />
                      )}
                    </div>
                    <div
                      className="resource-action"
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="secondary-button"
                        onClick={() => setCertificateGear(gear)}
                      >
                        <FileText size={13} />{" "}
                        {documentCount ? "View documents" : "View certificate"}
                      </button>
                      {gear.status === "Expired" && (
                        <span className="status-badge red">
                          <Lock size={9} />
                          Selection blocked
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {visibleGears.length === 0 && (
              <div className="empty-state">No gear matches this filter.</div>
            )}
          </div>
        </div>
      </div>
      <GearCreateDialog
        open={addGearOpen}
        onClose={() => setAddGearOpen(false)}
        onSave={gear => {
          setAllGears(current => [...current, gear]);
          setAddGearOpen(false);
          toast.success(
            gear.status === "Expired" ? "Gear added and blocked" : "Gear added",
            {
              description:
                gear.status === "Expired"
                  ? `${gear.name} has expired documentation and cannot be selected for a booking.`
                  : `${gear.name} is available for certificate review.`,
            }
          );
        }}
      />
      <GearCertificateDialog
        gear={certificateGear}
        onClose={() => setCertificateGear(null)}
      />
    </>
  );
}

export function GearCertificateDialog({
  gear,
  onClose,
}: {
  gear: GearRecord | null;
  onClose: () => void;
}) {
  if (!gear) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="confirmation-modal gear-create-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="certificate-preview-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="panel-header">
          <div>
            <div id="certificate-preview-title" className="panel-title">
              Inspection documents
            </div>
            <div className="panel-meta">Certificate record · {gear.cert}</div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close certificate preview"
          >
            <X size={16} />
          </button>
        </div>
        <div className="detail-list">
          <div className="detail-cell">
            <label>Asset</label>
            <div>{gear.name}</div>
          </div>
          <div className="detail-cell">
            <label>Type / safe working load</label>
            <div>{gear.type}</div>
          </div>
          <div className="detail-cell">
            <label>Certificate number</label>
            <div>{gear.cert}</div>
          </div>
          <div className="detail-cell">
            <label>Validity period</label>
            <div>
              {gear.validFrom && gear.validUntil
                ? `${formatGearValidityDate(gear.validFrom)} – ${formatGearValidityDate(gear.validUntil)}`
                : `Valid through ${gear.expires}`}
            </div>
          </div>
          <div className="detail-cell">
            <label>Selection state</label>
            <div>
              <StatusBadge
                value={
                  gear.status === "Expired" ? "Selection blocked" : "Compliant"
                }
              />
            </div>
          </div>
        </div>
        <div className="compliance-list" style={{ marginTop: 14 }}>
          {gear.documents?.length ? (
            gear.documents.map((document, index) => (
              <a
                key={`${document.name}-${index}`}
                href={document.url}
                target="_blank"
                rel="noreferrer"
                className="compliance-row clickable-row"
              >
                <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                  <FileText size={15} />
                  <div>
                    <div className="compliance-name">{document.name}</div>
                    <div className="compliance-sub">
                      {document.contentType ?? "Inspection document"}
                      {document.size
                        ? ` · ${(document.size / 1024).toFixed(0)} KB`
                        : ""}
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} />
              </a>
            ))
          ) : (
            <div className="empty-state">
              This established asset has a legacy inspection reference but no
              uploaded source file.
            </div>
          )}
        </div>
        <div className="confirmation-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

type GearCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (gear: GearRecord) => void;
};

export function GearCreateDialog({ open, onClose, onSave }: GearCreateDialogProps) {
  const uploadGearDocument = trpc.operations.uploadGearDocument.useMutation();
  const [form, setForm] = useState({
    name: "",
    type: "",
    cert: "",
    validFrom: "",
    validUntil: "",
  });
  const [documents, setDocuments] = useState<File[]>([]);
  useEffect(() => {
    if (open) {
      setForm({ name: "", type: "", cert: "", validFrom: "", validUntil: "" });
      setDocuments([]);
    }
  }, [open]);
  if (!open) return null;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !form.name.trim() ||
      !form.type.trim() ||
      !form.cert.trim() ||
      !form.validFrom ||
      !form.validUntil ||
      !documents.length
    ) {
      toast.error("Complete the compliant gear record", {
        description:
          "Add the asset details, an inspection document, and the document validity period.",
      });
      return;
    }
    if (!isValidGearDocumentPeriod(form.validFrom, form.validUntil)) {
      toast.error("Check the validity period", {
        description:
          "The validity end date must be on or after the validity start date.",
      });
      return;
    }
    if (documents.some(file => file.size > 7_500_000)) {
      toast.error("Document too large", {
        description: "Each gear inspection document must be 7.5 MB or smaller.",
      });
      return;
    }
    try {
      const uploadedDocuments = await Promise.all(
        documents.map(async file => {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve(String(reader.result).split(",")[1] ?? "");
            reader.onerror = () =>
              reject(new Error(`Unable to read ${file.name}.`));
            reader.readAsDataURL(file);
          });
          return await uploadGearDocument.mutateAsync({
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            base64,
          });
        })
      );
      const status = gearDocumentStatus(form.validUntil);
      const record: GearRecord = {
        name: form.name.trim(),
        type: form.type.trim(),
        cert: form.cert.trim(),
        expires: formatGearValidityDate(form.validUntil),
        validFrom: form.validFrom,
        validUntil: form.validUntil,
        status,
        selected: false,
        documents: uploadedDocuments,
      };
      if (
        !gears.some(
          gear => gear.name === record.name && gear.cert === record.cert
        )
      )
        gears.push(record);
      onSave(record);
    } catch (error) {
      toast.error("Document upload failed", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  };
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="confirmation-modal gear-create-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-gear-title"
        onClick={event => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="panel-header">
          <div>
            <div id="add-gear-title" className="panel-title">
              Add lifting gear
            </div>
            <div className="panel-meta">
              Upload inspection evidence and enter its validity period before
              the asset enters inventory.
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close add gear dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>Gear name *</span>
            <input
              className="form-input"
              value={form.name}
              onChange={event =>
                setForm(current => ({ ...current, name: event.target.value }))
              }
              placeholder="e.g. Bow shackle · 35T"
            />
          </label>
          <label className="form-field">
            <span>Type / SWL *</span>
            <input
              className="form-input"
              value={form.type}
              onChange={event =>
                setForm(current => ({ ...current, type: event.target.value }))
              }
              placeholder="e.g. Shackles · Grade 8"
            />
          </label>
          <label className="form-field">
            <span>Inspection certificate *</span>
            <input
              className="form-input"
              value={form.cert}
              onChange={event =>
                setForm(current => ({ ...current, cert: event.target.value }))
              }
              placeholder="INS-2026-000"
            />
          </label>
          <label className="form-field">
            <span>Inspection document(s) *</span>
            <input
              className="form-input"
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp,.docx"
              onChange={event =>
                setDocuments(Array.from(event.target.files ?? []))
              }
              aria-label="Upload lifting gear inspection documents"
            />
            <small>
              {documents.length
                ? `${documents.length} document${documents.length === 1 ? "" : "s"} ready to upload`
                : "PDF, image, or DOCX · up to 7.5 MB each"}
            </small>
          </label>
          <label className="form-field">
            <span>Document valid from *</span>
            <input
              className="form-input"
              type="date"
              value={form.validFrom}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  validFrom: event.target.value,
                }))
              }
            />
          </label>
          <label className="form-field">
            <span>Document valid until *</span>
            <input
              className="form-input"
              type="date"
              value={form.validUntil}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  validUntil: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <div className="notification" style={{ marginTop: 14 }}>
          <div className="title">
            <Upload
              size={14}
              style={{ verticalAlign: "-2px", marginRight: 6 }}
            />
            Compliance gate
          </div>
          <div className="body">
            Documents are stored with the gear record. A past validity end date
            keeps the asset visible but blocks it from booking selection.
          </div>
        </div>
        <div className="confirmation-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={uploadGearDocument.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={uploadGearDocument.isPending}
          >
            {uploadGearDocument.isPending
              ? "Uploading documents…"
              : "Upload documents & add gear"}
          </button>
        </div>
      </form>
    </div>
  );
}

