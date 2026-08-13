import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BookmarkCheck, CheckCircle2, CloudUpload, Download, FileCheck2, FileSpreadsheet, RefreshCw, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { applyMappingPreference, createMappingPreference, departmentImportFields, mapSpreadsheetRows, missingRequiredFields, templateRows, type ColumnMapping, type MappingPreferenceMap, type SpreadsheetRow } from "@shared/dataMapping";

export type UploadRecord = {
  departmentId: string;
  fileName: string;
  size: number;
  rowCount: number;
  uploadedAt: string;
  status: "Ready" | "Processing" | "Needs upload" | "Error";
  preview: string[];
  sourceHeaders: string[];
  mapping: ColumnMapping;
  data: SpreadsheetRow[];
};

export type UploadMap = Record<string, UploadRecord>;

type PendingWorkbook = {
  departmentId: string;
  fileName: string;
  size: number;
  sheetName: string;
  headers: string[];
  rows: SpreadsheetRow[];
  mappings: ColumnMapping;
  preferenceMatchedCount: number;
  preferenceSavedCount: number;
  preferenceChangedHeaders: string[];
  savePreference: boolean;
};

const MAPPING_PREFERENCE_STORAGE_KEY = "bob-cranes-department-mapping-preferences-v1";

export const uploadDepartmentCards = [
  { id: "sales", name: "Sales & Client Relations", description: "Client register, LPO references, and booking intake." },
  { id: "documentation", name: "Documentation & Permits", description: "Dossiers, permits, method statements, and client submissions." },
  { id: "lifting-gears", name: "Lifting Gears / Engineering", description: "Gear register, inspection certificates, and lifting plans." },
  { id: "maintenance", name: "Maintenance", description: "Crane service history, inspections, and maintenance actions." },
  { id: "crew", name: "Crew / Workmen Assignment", description: "Employee roster, certificates, availability, and assignments." },
  { id: "hse", name: "HSE / Safety", description: "Safety approvals, training, incidents, and risk controls." },
  { id: "accounts", name: "Accounts", description: "Invoices, commercial documents, and account release controls." },
  { id: "hr", name: "HR", description: "Attendance, leave, employee records, and HR compliance." },
  { id: "transportation", name: "Transportation", description: "Trailers, delivery notes, drivers, and site movement." },
  { id: "administrator", name: "Administrator / Super Admin", description: "System users, permissions, audit exports, and master data." },
] as const;

function loadMappingPreferences(): MappingPreferenceMap {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(MAPPING_PREFERENCE_STORAGE_KEY);
    return stored ? JSON.parse(stored) as MappingPreferenceMap : {};
  } catch {
    return {};
  }
}

function storeMappingPreferences(preferences: MappingPreferenceMap) {
  if (typeof window !== "undefined") window.localStorage.setItem(MAPPING_PREFERENCE_STORAGE_KEY, JSON.stringify(preferences));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function workbookFileName(label: string) {
  return `BOB_${label.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
}

function readWorkbook(file: File, onComplete: (workbook: Omit<PendingWorkbook, "mappings" | "preferenceMatchedCount" | "preferenceSavedCount" | "preferenceChangedHeaders" | "savePreference">) => void, onError: (message: string) => void) {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const result = event.target?.result;
      if (!(result instanceof ArrayBuffer)) throw new Error("Workbook could not be read.");
      const workbook = XLSX.read(result, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("The workbook has no visible sheets.");
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "" });
      const headerIndex = rawRows.findIndex((row) => row.some((cell) => String(cell).trim().length > 0));
      if (headerIndex < 0) throw new Error("The workbook does not contain a header row.");
      const headers = rawRows[headerIndex].map((cell, index) => String(cell).trim() || `Column ${index + 1}`);
      const rows = rawRows.slice(headerIndex + 1)
        .filter((row) => row.some((cell) => String(cell).trim().length > 0))
        .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
      onComplete({ departmentId: "", fileName: file.name, size: file.size, sheetName, headers, rows });
    } catch (error) {
      onError(error instanceof Error ? error.message : "The workbook could not be parsed.");
    }
  };
  reader.onerror = () => onError("The workbook could not be read.");
  reader.readAsArrayBuffer(file);
}

export default function DataUploadCenter({ uploads, setUploads }: { uploads: UploadMap; setUploads: React.Dispatch<React.SetStateAction<UploadMap>> }) {
  const [notice, setNotice] = useState("");
  const [pendingWorkbook, setPendingWorkbook] = useState<PendingWorkbook | null>(null);
  const [mappingPreferences, setMappingPreferences] = useState<MappingPreferenceMap>(() => loadMappingPreferences());
  const uploadedCount = Object.values(uploads).filter((record) => record.status === "Ready").length;
  const totalRows = Object.values(uploads).reduce((total, record) => total + record.rowCount, 0);
  const summaryLabel = useMemo(() => `${uploadedCount} of ${uploadDepartmentCards.length} departments updated`, [uploadedCount]);
  const activeDepartment = pendingWorkbook ? uploadDepartmentCards.find((department) => department.id === pendingWorkbook.departmentId) : undefined;
  const activeFields = pendingWorkbook ? departmentImportFields[pendingWorkbook.departmentId] ?? [] : [];
  const requiredMissing = pendingWorkbook ? missingRequiredFields(activeFields, pendingWorkbook.mappings) : [];
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); };

  const updateMapping = (fieldId: string, sourceHeader: string) => {
    setPendingWorkbook((current) => {
      if (!current) return current;
      const mappings = { ...current.mappings };
      if (sourceHeader === "__unmapped__") delete mappings[fieldId];
      else mappings[fieldId] = sourceHeader;
      return { ...current, mappings };
    });
  };

  const removePreference = (departmentId: string) => {
    setMappingPreferences((current) => {
      const next = { ...current };
      delete next[departmentId];
      storeMappingPreferences(next);
      return next;
    });
    notify("Saved column mapping removed for this department.");
  };

  const handleFile = (departmentId: string, file?: File) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) { notify("Please upload an Excel workbook (.xlsx or .xls)."); return; }
    setUploads((current) => ({ ...current, [departmentId]: { departmentId, fileName: file.name, size: file.size, rowCount: 0, uploadedAt: "Reading workbook…", status: "Processing", preview: [], sourceHeaders: [], mapping: {}, data: [] } }));
    readWorkbook(file, (workbook) => {
      setUploads((current) => { const next = { ...current }; delete next[departmentId]; return next; });
      const fields = departmentImportFields[departmentId] ?? [];
      const preferenceApplication = applyMappingPreference(fields, workbook.headers, mappingPreferences[departmentId]);
      setPendingWorkbook({
        ...workbook,
        departmentId,
        mappings: preferenceApplication.mapping,
        preferenceMatchedCount: preferenceApplication.matchedCount,
        preferenceSavedCount: preferenceApplication.savedCount,
        preferenceChangedHeaders: preferenceApplication.changedHeaders,
        savePreference: true,
      });
    }, (message) => {
      setUploads((current) => { const next = { ...current }; delete next[departmentId]; return next; });
      notify(message);
    });
  };

  const confirmImport = () => {
    if (!pendingWorkbook || requiredMissing.length) return;
    const fields = departmentImportFields[pendingWorkbook.departmentId] ?? [];
    const mappedRows = mapSpreadsheetRows(fields, pendingWorkbook.mappings, pendingWorkbook.rows);
    const preview = mappedRows.slice(0, 3).map((row) => Object.entries(row).slice(0, 4).map(([key, value]) => `${key}: ${String(value).trim() || "—"}`).join(" · "));
    setUploads((current) => ({ ...current, [pendingWorkbook.departmentId]: {
      departmentId: pendingWorkbook.departmentId,
      fileName: pendingWorkbook.fileName,
      size: pendingWorkbook.size,
      rowCount: mappedRows.length,
      uploadedAt: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      status: "Ready",
      preview,
      sourceHeaders: pendingWorkbook.headers,
      mapping: pendingWorkbook.mappings,
      data: mappedRows,
    } }));
    if (pendingWorkbook.savePreference) {
      const preference = createMappingPreference(pendingWorkbook.departmentId, pendingWorkbook.mappings, pendingWorkbook.headers);
      setMappingPreferences((current) => {
        const next = { ...current, [pendingWorkbook.departmentId]: preference };
        storeMappingPreferences(next);
        return next;
      });
    }
    notify(`${pendingWorkbook.fileName} was accepted with ${Object.keys(pendingWorkbook.mappings).length} mapped fields${pendingWorkbook.savePreference ? " and the mapping was saved" : ""}.`);
    setPendingWorkbook(null);
  };

  const removeFile = (departmentId: string) => {
    setUploads((current) => { const next = { ...current }; delete next[departmentId]; return next; });
    notify("Department workbook removed from this session.");
  };

  const exportDepartment = (departmentId: string) => {
    const department = uploadDepartmentCards.find((item) => item.id === departmentId);
    if (!department) return;
    const fields = departmentImportFields[departmentId] ?? [];
    const rows = uploads[departmentId]?.data?.length ? uploads[departmentId].data : templateRows(fields);
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, department.name.slice(0, 31));
    XLSX.writeFile(workbook, workbookFileName(department.name));
    notify(`${department.name} Excel export generated.`);
  };

  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Data operations</div><h1 className="page-title">Excel data uploads</h1><p className="page-copy">Upload the latest workbook for each department, map its columns to BOB system fields, and export prepared data when needed.</p></div><div className="upload-summary-pill"><FileCheck2 size={15} /><span><strong>{summaryLabel}</strong><small>{totalRows.toLocaleString()} data rows indexed in this session</small></span></div></div><div className="upload-summary-grid"><div className="upload-summary-card"><div className="metric-label">Department coverage</div><div className="analytics-inline-progress upload-coverage-progress"><div className="reference-progress-copy"><strong>{uploadedCount} of {uploadDepartmentCards.length} departments ready</strong><span>Accepted workbooks indexed</span></div><div className="analytics-inline-meter"><div className="analytics-inline-fill" style={{ width: `${(uploadedCount / uploadDepartmentCards.length) * 100}%` }} /></div><strong className="analytics-inline-value">{Math.round((uploadedCount / uploadDepartmentCards.length) * 100)}%</strong></div></div><div className="upload-summary-card"><div className="metric-label">Accepted format</div><div className="upload-format">.xlsx / .xls</div><div className="metric-foot"><FileSpreadsheet size={13} /> Header mapping before import</div></div><div className="upload-summary-card"><div className="metric-label">Data handling</div><div className="upload-format">Import + export</div><div className="metric-foot"><Download size={13} /> Department-ready workbooks</div></div></div>{pendingWorkbook && activeDepartment && <section className="mapping-panel"><div className="mapping-header"><div><div className="eyebrow">Step 2 of 2 · Confirm mapping</div><div className="panel-title">Map {pendingWorkbook.fileName} to {activeDepartment.name}</div><div className="panel-meta">Detected {pendingWorkbook.headers.length} source columns on sheet “{pendingWorkbook.sheetName}”. Required BOB fields must be mapped before this workbook is accepted.</div></div><button className="icon-button" onClick={() => setPendingWorkbook(null)} aria-label="Close column mapping"><X size={16} /></button></div><div className="mapping-summary"><span className={requiredMissing.length ? "mapping-warning" : "mapping-complete"}>{requiredMissing.length ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}{requiredMissing.length ? `${requiredMissing.length} required field${requiredMissing.length === 1 ? "" : "s"} still unmapped` : "All required fields mapped"}</span><span>{Object.keys(pendingWorkbook.mappings).length} of {activeFields.length} system fields selected</span></div>{pendingWorkbook.preferenceSavedCount > 0 && <div className={`mapping-preference-banner ${pendingWorkbook.preferenceChangedHeaders.length ? "review" : "applied"}`}><BookmarkCheck size={15} /><div><strong>{pendingWorkbook.preferenceMatchedCount} of {pendingWorkbook.preferenceSavedCount} saved mappings applied automatically.</strong><span>{pendingWorkbook.preferenceChangedHeaders.length ? `Review required: ${pendingWorkbook.preferenceChangedHeaders.join(", ")} was not found in this upload.` : "The source headers match this department’s saved preference."}</span></div></div>}<div className="mapping-grid"><div className="mapping-list">{activeFields.map((field) => <div className={`mapping-row ${field.required && !pendingWorkbook.mappings[field.id] ? "incomplete" : ""}`} key={field.id}><div className="mapping-system-field"><div className="compliance-name">{field.label}{field.required && <span className="required-indicator">Required</span>}</div><div className="compliance-sub">BOB system field</div></div><ArrowRight className="mapping-arrow" size={15} /><select className="mapping-select" value={pendingWorkbook.mappings[field.id] ?? "__unmapped__"} onChange={(event) => updateMapping(field.id, event.target.value)}><option value="__unmapped__">Not mapped</option>{pendingWorkbook.headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></div>)}</div><div className="mapping-source-panel"><div className="mapping-source-title">Detected source columns</div><div className="mapping-header-chips">{pendingWorkbook.headers.map((header) => <span key={header} className={Object.values(pendingWorkbook.mappings).includes(header) ? "mapped" : ""}>{header}</span>)}</div><div className="mapping-sample-title">First data row</div>{pendingWorkbook.rows[0] ? <div className="mapping-sample-grid">{pendingWorkbook.headers.slice(0, 8).map((header) => <div key={header}><span>{header}</span><strong>{String(pendingWorkbook.rows[0][header] ?? "—")}</strong></div>)}</div> : <div className="panel-meta">No data rows found after the header row.</div>}</div></div><div className="mapping-footer"><label className="mapping-save-toggle"><input type="checkbox" checked={pendingWorkbook.savePreference} onChange={(event) => setPendingWorkbook((current) => current ? { ...current, savePreference: event.target.checked } : current)} /><span><BookmarkCheck size={13} /> {mappingPreferences[pendingWorkbook.departmentId] ? "Update saved mapping preference for this department" : "Remember this mapping for future uploads"}</span></label><div className="mapping-actions"><button className="secondary-button" onClick={() => setPendingWorkbook(null)}>Cancel</button><button className="primary-button" disabled={requiredMissing.length > 0} onClick={confirmImport}><FileCheck2 size={14} /> Confirm mapping & import</button></div></div></section>}<div className="upload-grid">{uploadDepartmentCards.map((department) => { const record = uploads[department.id]; const preference = mappingPreferences[department.id]; return <div className={`upload-card ${record?.status === "Ready" ? "uploaded" : ""}`} key={department.id}><div className="upload-card-header"><div className="upload-department-icon"><FileSpreadsheet size={17} /></div><div><div className="panel-title">{department.name}</div><div className="panel-meta">{department.description}</div></div></div>{preference && <div className="saved-preference-row"><BookmarkCheck size={12} /><span>{Object.keys(preference.mapping).length} saved column mappings</span><button onClick={() => removePreference(department.id)}>Forget</button></div>}{record?.status === "Processing" ? <div className="upload-processing"><RefreshCw size={15} className="spin" /> Reading workbook…</div> : record?.status === "Ready" ? <div className="upload-record"><div className="upload-record-top"><div><div className="upload-file-name">{record.fileName}</div><div className="upload-file-meta">{formatBytes(record.size)} · {record.rowCount.toLocaleString()} data rows · Updated {record.uploadedAt}</div></div><span className="status-badge green"><FileCheck2 size={9} />Ready</span></div><div className="upload-mapping-meta"><FileCheck2 size={12} /> {Object.keys(record.mapping).length} columns mapped · {record.sourceHeaders.length} detected</div>{record.preview.length > 0 && <div className="upload-preview">{record.preview.map((row, index) => <div key={`${record.fileName}-${index}`}>{row}</div>)}</div>}<div className="upload-card-actions"><label className="secondary-button upload-button"><RefreshCw size={13} /> Replace<input type="file" accept=".xlsx,.xls" onChange={(event) => handleFile(department.id, event.target.files?.[0])} /></label><button className="secondary-button export-button" onClick={() => exportDepartment(department.id)}><Download size={13} /> Export</button><button className="text-button danger" onClick={() => removeFile(department.id)}><Trash2 size={13} /> Remove</button></div></div> : <div className="upload-card-empty"><label className="upload-dropzone"><CloudUpload size={20} /><span>Choose Excel workbook</span><small>Drag and drop or browse · .xlsx / .xls</small><input type="file" accept=".xlsx,.xls" onChange={(event) => handleFile(department.id, event.target.files?.[0])} /></label><button className="template-export" onClick={() => exportDepartment(department.id)}><Download size={13} /> Download export template</button></div>}</div>; })}</div>{notice && <div className="toast-note"><FileCheck2 size={14} style={{ verticalAlign: "-2px", marginRight: 7 }} />{notice}</div>}</div>;
}
