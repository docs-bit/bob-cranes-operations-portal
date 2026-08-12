import { useMemo, useState } from "react";
import { CloudUpload, FileCheck2, FileSpreadsheet, RefreshCw, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

export type UploadRecord = {
  departmentId: string;
  fileName: string;
  size: number;
  rowCount: number;
  uploadedAt: string;
  status: "Ready" | "Processing" | "Needs upload" | "Error";
  preview: string[];
};

export type UploadMap = Record<string, UploadRecord>;

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

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function parseWorkbook(file: File, departmentId: string, onComplete: (record: UploadRecord) => void, onError: (message: string) => void) {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const result = event.target?.result;
      if (!(result instanceof ArrayBuffer)) throw new Error("Workbook could not be read.");
      const workbook = XLSX.read(result, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("The workbook has no visible sheets.");
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "" });
      const meaningfulRows = rows.filter((row) => row.some((cell) => String(cell).trim().length > 0));
      const preview = meaningfulRows.slice(0, 3).map((row) => row.slice(0, 4).map((cell) => String(cell).trim() || "—").join(" · "));
      onComplete({
        departmentId,
        fileName: file.name,
        size: file.size,
        rowCount: Math.max(0, meaningfulRows.length - 1),
        uploadedAt: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        status: "Ready",
        preview,
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : "The workbook could not be parsed.");
    }
  };
  reader.onerror = () => onError("The workbook could not be read.");
  reader.readAsArrayBuffer(file);
}

export default function DataUploadCenter({ uploads, setUploads }: { uploads: UploadMap; setUploads: React.Dispatch<React.SetStateAction<UploadMap>> }) {
  const [notice, setNotice] = useState("");
  const uploadedCount = Object.values(uploads).filter((record) => record.status === "Ready").length;
  const totalRows = Object.values(uploads).reduce((total, record) => total + record.rowCount, 0);
  const summaryLabel = useMemo(() => `${uploadedCount} of ${uploadDepartmentCards.length} departments updated`, [uploadedCount]);
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); };
  const handleFile = (departmentId: string, file?: File) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) { notify("Please upload an Excel workbook (.xlsx or .xls)."); return; }
    setUploads((current) => ({ ...current, [departmentId]: { departmentId, fileName: file.name, size: file.size, rowCount: 0, uploadedAt: "Reading workbook…", status: "Processing", preview: [] } }));
    parseWorkbook(file, departmentId, (record) => { setUploads((current) => ({ ...current, [departmentId]: record })); notify(`${file.name} is ready for ${uploadDepartmentCards.find((item) => item.id === departmentId)?.name}.`); }, (message) => { setUploads((current) => { const next = { ...current }; delete next[departmentId]; return next; }); notify(message); });
  };
  const removeFile = (departmentId: string) => { setUploads((current) => { const next = { ...current }; delete next[departmentId]; return next; }); notify("Department workbook removed from this session."); };
  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Data operations</div><h1 className="page-title">Excel data uploads</h1><p className="page-copy">Upload the latest workbook for each department and keep the operating data ready for review.</p></div><div className="upload-summary-pill"><FileCheck2 size={15} /><span><strong>{summaryLabel}</strong><small>{totalRows.toLocaleString()} data rows indexed in this session</small></span></div></div><div className="upload-summary-grid"><div className="upload-summary-card"><div className="metric-label">Department coverage</div><div className="metric-value">{Math.round((uploadedCount / uploadDepartmentCards.length) * 100)}%</div><div className="progress-track"><div className="progress-fill green" style={{ width: `${(uploadedCount / uploadDepartmentCards.length) * 100}%` }} /></div></div><div className="upload-summary-card"><div className="metric-label">Accepted format</div><div className="upload-format">.xlsx / .xls</div><div className="metric-foot"><FileSpreadsheet size={13} /> One workbook per department</div></div><div className="upload-summary-card"><div className="metric-label">Data handling</div><div className="upload-format">Preview first</div><div className="metric-foot"><FileCheck2 size={13} /> File name, rows, and sample headers</div></div></div><div className="upload-grid">{uploadDepartmentCards.map((department) => { const record = uploads[department.id]; return <div className={`upload-card ${record?.status === "Ready" ? "uploaded" : ""}`} key={department.id}><div className="upload-card-header"><div className="upload-department-icon"><FileSpreadsheet size={17} /></div><div><div className="panel-title">{department.name}</div><div className="panel-meta">{department.description}</div></div></div>{record?.status === "Processing" ? <div className="upload-processing"><RefreshCw size={15} className="spin" /> Reading workbook…</div> : record?.status === "Ready" ? <div className="upload-record"><div className="upload-record-top"><div><div className="upload-file-name">{record.fileName}</div><div className="upload-file-meta">{formatBytes(record.size)} · {record.rowCount.toLocaleString()} data rows · Updated {record.uploadedAt}</div></div><span className="status-badge green"><FileCheck2 size={9} />Ready</span></div>{record.preview.length > 0 && <div className="upload-preview">{record.preview.map((row, index) => <div key={`${record.fileName}-${index}`}>{row}</div>)}</div>}<div className="upload-card-actions"><label className="secondary-button upload-button"><RefreshCw size={13} /> Replace<input type="file" accept=".xlsx,.xls" onChange={(event) => handleFile(department.id, event.target.files?.[0])} /></label><button className="text-button danger" onClick={() => removeFile(department.id)}><Trash2 size={13} /> Remove</button></div></div> : <label className="upload-dropzone"><CloudUpload size={20} /><span>Choose Excel workbook</span><small>Drag and drop or browse · .xlsx / .xls</small><input type="file" accept=".xlsx,.xls" onChange={(event) => handleFile(department.id, event.target.files?.[0])} /></label>}</div>; })}</div>{notice && <div className="toast-note"><FileCheck2 size={14} style={{ verticalAlign: "-2px", marginRight: 7 }} />{notice}</div>}</div>;
}
