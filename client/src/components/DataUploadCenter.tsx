import React, { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BookmarkCheck, CheckCircle2, CloudUpload, Download, FileCheck2, FileSpreadsheet, RefreshCw, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { applyMappingPreference, createMappingPreference, departmentImportFields, disambiguateHeaders, mapSpreadsheetRows, missingRequiredFields, templateRows, type ColumnMapping, type MappingPreferenceMap, type SpreadsheetRow } from "@shared/dataMapping";

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

const MAX_WORKBOOK_SIZE = 20 * 1024 * 1024;

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
      if (!(result instanceof ArrayBuffer)) throw new Error("Workbook could not be read as binary data.");
      if (result.byteLength === 0) throw new Error("The selected workbook is empty.");
      const workbook = XLSX.read(new Uint8Array(result), { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("The workbook has no visible sheets.");
      const sheet = workbook.Sheets[sheetName];
      if (!sheet || !sheet["!ref"]) throw new Error("The first worksheet is empty.");
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false });
      const headerIndex = rawRows.findIndex((row) => row.some((cell) => String(cell).trim().length > 0));
      if (headerIndex < 0) throw new Error("The workbook does not contain a header row.");
      const headers = disambiguateHeaders(rawRows[headerIndex].map((cell) => String(cell)));
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
  const [draggedDepartmentId, setDraggedDepartmentId] = useState<string | null>(null);
  const [pendingWorkbook, setPendingWorkbook] = useState<PendingWorkbook | null>(null);
  const [workbookPreviewOpen, setWorkbookPreviewOpen] = useState(false);
  const [mappingPreferences, setMappingPreferences] = useState<MappingPreferenceMap>(() => loadMappingPreferences());
  const uploadedCount = Object.values(uploads).filter((record) => record.status === "Ready").length;
  const totalRows = Object.values(uploads).reduce((total, record) => total + record.rowCount, 0);
  const summaryLabel = useMemo(() => `${uploadedCount} of ${uploadDepartmentCards.length} departments updated`, [uploadedCount]);
  const activeDepartment = pendingWorkbook ? uploadDepartmentCards.find((department) => department.id === pendingWorkbook.departmentId) : undefined;
  const activeFields = pendingWorkbook ? departmentImportFields[pendingWorkbook.departmentId] ?? [] : [];
  const requiredMissing = pendingWorkbook ? missingRequiredFields(activeFields, pendingWorkbook.mappings) : [];
  const rowValidationErrors = useMemo(() => {
    if (!pendingWorkbook) return [];
    const fields = activeFields;
    const errors: Array<{ rowIndex: number; rowSummary: string; messages: string[] }> = [];
    pendingWorkbook.rows.forEach((row, index) => {
      const rowMessages: string[] = [];
      const primaryKeyField = fields.find(field => field.required) ?? fields[0];
      if (primaryKeyField) {
        const mappedHeader = pendingWorkbook.mappings[primaryKeyField.id];
        if (mappedHeader && mappedHeader !== "__unmapped__") {
          const val = String(row[mappedHeader] ?? "").trim();
          if (!val) {
            rowMessages.push(`Missing required field “${primaryKeyField.label}”`);
          }
        }
      }
      fields.forEach(field => {
        if (field.id.includes("amount") || field.id.includes("rate") || field.id.includes("tons") || field.id.includes("capacity")) {
          const mappedHeader = pendingWorkbook.mappings[field.id];
          if (mappedHeader && mappedHeader !== "__unmapped__") {
            const rawVal = String(row[mappedHeader] ?? "").trim();
            if (rawVal && isNaN(Number(rawVal))) {
              rowMessages.push(`Non-numeric value in “${field.label}” (${rawVal})`);
            }
          }
        }
      });
      if (rowMessages.length > 0) {
        const sampleKeys = Object.values(pendingWorkbook.mappings).filter(h => h && h !== "__unmapped__").slice(0, 2);
        const summary = sampleKeys.map(h => `${h}: ${String(row[h] ?? "—")}`).join(" · ") || `Row ${index + 1}`;
        errors.push({ rowIndex: index + 1, rowSummary: summary, messages: rowMessages });
      }
    });
    return errors;
  }, [activeFields, pendingWorkbook]);
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
    if (file.size === 0) { notify(`${file.name} is empty. Choose a workbook with at least one worksheet.`); return; }
    if (file.size > MAX_WORKBOOK_SIZE) { notify(`${file.name} is larger than the 20MB workbook limit.`); return; }
    setDraggedDepartmentId(null);
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

  const handleWorkbookFiles = (departmentId: string, files: FileList | File[]) => {
    const selected = Array.from(files)[0];
    handleFile(departmentId, selected);
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

  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Data operations</div><h1 className="page-title">Excel data uploads</h1><p className="page-copy">Upload the latest workbook for each department, map its columns to BOB system fields, and export prepared data when needed.</p></div><div className="upload-summary-pill"><FileCheck2 size={15} /><span><strong>{summaryLabel}</strong><small>{totalRows.toLocaleString()} data rows indexed in this session</small></span></div></div><div className="upload-summary-grid"><div className="upload-summary-card"><div className="metric-label">Department coverage</div><div className="analytics-inline-progress upload-coverage-progress"><div className="reference-progress-copy"><strong>{uploadedCount} of {uploadDepartmentCards.length} departments ready</strong><span>Accepted workbooks indexed</span></div><div className="analytics-inline-meter"><div className="analytics-inline-fill" style={{ width: `${(uploadedCount / uploadDepartmentCards.length) * 100}%` }} /></div><strong className="analytics-inline-value">{Math.round((uploadedCount / uploadDepartmentCards.length) * 100)}%</strong></div></div><div className="upload-summary-card"><div className="metric-label">Accepted format</div><div className="upload-format">.xlsx / .xls</div><div className="metric-foot"><FileSpreadsheet size={13} /> Header mapping before import</div></div><div className="upload-summary-card"><div className="metric-label">Data handling</div><div className="upload-format">Import + export</div><div className="metric-foot"><Download size={13} /> Department-ready workbooks</div></div></div>{pendingWorkbook && activeDepartment && <section className="mapping-panel"><div className="mapping-header"><div><div className="eyebrow">Step 2 of 2 · Confirm mapping</div><div className="panel-title">Map {pendingWorkbook.fileName} to {activeDepartment.name}</div><div className="panel-meta">Detected {pendingWorkbook.headers.length} source columns on sheet “{pendingWorkbook.sheetName}”. Required BOB fields must be mapped before this workbook is accepted.</div></div><button className="icon-button" onClick={() => { setPendingWorkbook(null); setWorkbookPreviewOpen(false); }} aria-label="Close column mapping"><X size={16} /></button></div><div className="mapping-summary"><span className={requiredMissing.length ? "mapping-warning" : "mapping-complete"}>{requiredMissing.length ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}{requiredMissing.length ? `${requiredMissing.length} required field${requiredMissing.length === 1 ? "" : "s"} still unmapped` : "All required fields mapped"}</span><span>{Object.keys(pendingWorkbook.mappings).length} of {activeFields.length} system fields selected</span><button type="button" className="secondary-button" onClick={() => setWorkbookPreviewOpen(true)}><FileSpreadsheet size={13} /> Preview workbook</button></div>{rowValidationErrors.length > 0 && <div className="mapping-preference-banner review" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}><AlertTriangle size={16} /><div style={{ flex: 1 }}><strong>Found {rowValidationErrors.length} row validation issue{rowValidationErrors.length === 1 ? "" : "s"}.</strong><span>Review the preview table below to inspect flagged rows before import.</span></div></div>}{pendingWorkbook.preferenceSavedCount > 0 && <div className={`mapping-preference-banner ${pendingWorkbook.preferenceChangedHeaders.length ? "review" : "applied"}`}><BookmarkCheck size={15} /><div><strong>{pendingWorkbook.preferenceMatchedCount} of {pendingWorkbook.preferenceSavedCount} saved mappings applied automatically.</strong><span>{pendingWorkbook.preferenceChangedHeaders.length ? `Review required: ${pendingWorkbook.preferenceChangedHeaders.join(", ")} was not found in this upload.` : "The source headers match this department’s saved preference."}</span></div></div>}<div className="mapping-grid"><div className="mapping-list">{activeFields.map((field) => <div className={`mapping-row ${field.required && !pendingWorkbook.mappings[field.id] ? "incomplete" : ""}`} key={field.id}><div className="mapping-system-field"><div className="compliance-name">{field.label}{field.required && <span className="required-indicator">Required</span>}</div><div className="compliance-sub">BOB system field</div></div><ArrowRight className="mapping-arrow" size={15} /><select className="mapping-select" value={pendingWorkbook.mappings[field.id] ?? "__unmapped__"} onChange={(event) => updateMapping(field.id, event.target.value)}><option value="__unmapped__">Not mapped</option>{pendingWorkbook.headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></div>)}</div><div className="mapping-source-panel"><div className="mapping-source-title">Detected source columns</div><div className="mapping-header-chips">{pendingWorkbook.headers.map((header) => <span key={header} className={Object.values(pendingWorkbook.mappings).includes(header) ? "mapped" : ""}>{header}</span>)}</div><div className="mapping-sample-title">First data row</div>{pendingWorkbook.rows[0] ? <div className="mapping-sample-grid">{pendingWorkbook.headers.slice(0, 8).map((header) => <div key={header}><span>{header}</span><strong>{String(pendingWorkbook.rows[0][header] ?? "—")}</strong></div>)}</div> : <div className="panel-meta">No data rows found after the header row.</div>}</div></div><div className="mapping-footer"><label className="mapping-save-toggle"><input type="checkbox" checked={pendingWorkbook.savePreference} onChange={(event) => setPendingWorkbook((current) => current ? { ...current, savePreference: event.target.checked } : current)} /><span><BookmarkCheck size={13} /> {mappingPreferences[pendingWorkbook.departmentId] ? "Update saved mapping preference for this department" : "Remember this mapping for future uploads"}</span></label><div className="mapping-actions"><button className="secondary-button" onClick={() => { setPendingWorkbook(null); setWorkbookPreviewOpen(false); }}>Cancel</button><button className="primary-button" disabled={requiredMissing.length > 0} onClick={confirmImport}><FileCheck2 size={14} /> Confirm mapping & import</button></div></div></section>}{pendingWorkbook && workbookPreviewOpen && <div role="dialog" aria-modal="true" aria-labelledby="workbook-preview-title" style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(15, 23, 42, 0.64)", padding: "5vh 4vw", display: "grid", placeItems: "center" }}><div style={{ width: "min(1180px, 100%)", maxHeight: "90vh", overflow: "hidden", background: "var(--card, #ffffff)", color: "var(--foreground, #111827)", borderRadius: 16, boxShadow: "0 24px 80px rgba(15, 23, 42, 0.28)", display: "flex", flexDirection: "column" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "18px 20px", borderBottom: "1px solid var(--border, #e2e8f0)" }}><div><div className="eyebrow">Workbook preview · before import</div><h2 id="workbook-preview-title" style={{ margin: "5px 0 4px", fontSize: 20 }}>{pendingWorkbook.fileName}</h2><div className="panel-meta">Sheet “{pendingWorkbook.sheetName}” · {pendingWorkbook.rows.length.toLocaleString()} data rows · Showing the first {Math.min(12, pendingWorkbook.rows.length)} rows.</div></div><button type="button" className="icon-button" onClick={() => setWorkbookPreviewOpen(false)} aria-label="Close workbook preview"><X size={16} /></button></div><div style={{ overflow: "auto", padding: 20, flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, fontSize: 11, color: "var(--muted-foreground, #64748b)" }}><span>Click any cell below to edit and correct data inline before final import.</span><div style={{ display: "flex", gap: 8, alignItems: "center" }}>{rowValidationErrors.length > 0 && <button type="button" className="secondary-button" onClick={() => {
    const targetHeader = window.prompt("Enter column header to apply batch correction to (e.g. Priority or Status):");
    if (!targetHeader || !pendingWorkbook.headers.includes(targetHeader)) return;
    const findVal = window.prompt(`Find cells containing text (leave blank to target empty cells):`, "");
    if (findVal === null) return;
    const replaceVal = window.prompt(`Replace with value:`, "Approved");
    if (replaceVal === null) return;
    setPendingWorkbook(current => {
      if (!current) return current;
      const nextRows = current.rows.map(row => {
        const cell = String(row[targetHeader] ?? "");
        if (findVal === "" ? cell === "" : cell.toLowerCase().includes(findVal.toLowerCase())) {
          return { ...row, [targetHeader]: replaceVal };
        }
        return row;
      });
      return { ...current, rows: nextRows };
    });
    notify(`Batch correction applied to column “${targetHeader}”.`);
  }} style={{ height: 28, fontSize: 11 }}>Batch fix flagged rows</button>}{rowValidationErrors.length > 0 && <button type="button" className="secondary-button" onClick={() => {
    const csvContent = [
      pendingWorkbook.headers.join(","),
      ...rowValidationErrors.map(({ rowIndex, messages: issues }) => {
        const row = pendingWorkbook.rows[rowIndex] ?? {};
        return pendingWorkbook.headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",");
      })
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${activeDepartment?.name ?? "department"}-flagged-rows.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Flagged validation rows exported to CSV.");
  }} style={{ height: 28, fontSize: 11 }}><Download size={12} /> Export flagged rows CSV ({rowValidationErrors.length})</button>}</div></div><table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 12 }}><thead><tr>{pendingWorkbook.headers.map(header => <th key={header} style={{ textAlign: "left", padding: "9px 10px", borderBottom: "2px solid var(--border, #cbd5e1)", background: "var(--muted, #f8fafc)", whiteSpace: "nowrap" }}>{header}</th>)}</tr></thead><tbody>{pendingWorkbook.rows.slice(0, 20).map((row, rowIndex) => {
    const hasError = rowValidationErrors.some(err => err.rowIndex === rowIndex);
    return (
      <tr key={`preview-row-${rowIndex}`} style={{ background: hasError ? "rgba(239, 68, 68, 0.06)" : undefined }}>
        {pendingWorkbook.headers.map(header => {
          const cellVal = String(row[header] ?? "");
          return (
            <td key={`${rowIndex}-${header}`} style={{ padding: "6px 8px", borderBottom: "1px solid var(--border, #e2e8f0)", maxWidth: 260 }}>
              <input
                type="text"
                value={cellVal}
                onChange={event => {
                  const nextVal = event.target.value;
                  setPendingWorkbook(current => {
                    if (!current) return current;
                    const nextRows = [...current.rows];
                    nextRows[rowIndex] = { ...nextRows[rowIndex], [header]: nextVal };
                    return { ...current, rows: nextRows };
                  });
                }}
                style={{ width: "100%", background: "transparent", border: "1px solid transparent", borderRadius: 4, padding: "3px 6px", fontSize: 12, color: "inherit" }}
                onFocus={e => e.target.style.borderColor = "#217c64"}
                onBlur={e => e.target.style.borderColor = "transparent"}
              />
            </td>
          );
        })}
      </tr>
    );
  })}</tbody></table>{pendingWorkbook.rows.length === 0 && <div className="empty-state" style={{ marginTop: 12 }}>No data rows were found after the header row.</div>}</div><div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--border, #e2e8f0)" }}><button type="button" className="secondary-button" onClick={() => setWorkbookPreviewOpen(false)}>Close preview</button></div></div></div>}<div className="upload-grid">{uploadDepartmentCards.map((department) => { const record = uploads[department.id]; const preference = mappingPreferences[department.id]; return <div className={`upload-card ${record?.status === "Ready" ? "uploaded" : ""}`} key={department.id}><div className="upload-card-header"><div className="upload-department-icon"><FileSpreadsheet size={17} /></div><div><div className="panel-title">{department.name}</div><div className="panel-meta">{department.description}</div></div></div>{preference && <div className="saved-preference-row"><BookmarkCheck size={12} /><span>{Object.keys(preference.mapping).length} saved column mappings</span><button onClick={() => removePreference(department.id)}>Forget</button></div>}{record?.status === "Processing" ? <div className="upload-processing"><RefreshCw size={15} className="spin" /> Reading workbook…</div> : record?.status === "Ready" ? <div className="upload-record"><div className="upload-record-top"><div><div className="upload-file-name">{record.fileName}</div><div className="upload-file-meta">{formatBytes(record.size)} · {record.rowCount.toLocaleString()} data rows · Updated {record.uploadedAt}</div></div><span className="status-badge green"><FileCheck2 size={9} />Ready</span></div><div className="upload-mapping-meta"><FileCheck2 size={12} /> {Object.keys(record.mapping).length} columns mapped · {record.sourceHeaders.length} detected</div>{record.preview.length > 0 && <div className="upload-preview">{record.preview.map((row, index) => <div key={`${record.fileName}-${index}`}>{row}</div>)}</div>}<div className="upload-card-actions"><label className="secondary-button upload-button"><RefreshCw size={13} /> Replace<input type="file" aria-label={`Replace workbook for ${department.name}`} accept=".xlsx,.xls" onChange={(event) => handleFile(department.id, event.target.files?.[0])} /></label><button className="secondary-button export-button" onClick={() => exportDepartment(department.id)}><Download size={13} /> Export</button><button className="text-button danger" onClick={() => removeFile(department.id)}><Trash2 size={13} /> Remove</button></div></div> : <div className="upload-card-empty"><label
                          className={`upload-dropzone ${draggedDepartmentId === department.id ? "drag-over" : ""}`}
                          onDragOver={(event) => { event.preventDefault(); setDraggedDepartmentId(department.id); }}
                          onDragEnter={(event) => { event.preventDefault(); setDraggedDepartmentId(department.id); }}
                          onDragLeave={(event) => { event.preventDefault(); setDraggedDepartmentId(null); }}
                          onDrop={(event) => { event.preventDefault(); setDraggedDepartmentId(null); handleWorkbookFiles(department.id, event.dataTransfer.files); }}
                          style={{ borderColor: draggedDepartmentId === department.id ? "#217c64" : undefined, background: draggedDepartmentId === department.id ? "rgba(33, 124, 100, 0.08)" : undefined }}
                        >
                          <CloudUpload size={20} />
                          <span>{draggedDepartmentId === department.id ? "Release to read workbook" : "Choose Excel workbook"}</span>
                          <small>Drag and drop or browse · .xlsx / .xls · max 20MB</small>
                          <input type="file" aria-label={`Upload workbook for ${department.name}`} accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => handleWorkbookFiles(department.id, event.target.files ?? [])} />
                        </label><button className="template-export" onClick={() => exportDepartment(department.id)}><Download size={13} /> Download export template</button></div>}</div>; })}</div>{notice && <div className="toast-note"><FileCheck2 size={14} style={{ verticalAlign: "-2px", marginRight: 7 }} />{notice}</div>}</div>;
}
