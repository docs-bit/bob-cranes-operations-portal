export type ImportField = {
  id: string;
  label: string;
  required: boolean;
  aliases: string[];
};

export type ColumnMapping = Record<string, string>;
export type SpreadsheetRow = Record<string, unknown>;
export type MappingPreference = {
  departmentId: string;
  mapping: ColumnMapping;
  headerSignature: string;
  savedAt: string;
};

export type MappingPreferenceMap = Record<string, MappingPreference>;

export type PreferenceApplication = {
  mapping: ColumnMapping;
  matchedCount: number;
  savedCount: number;
  changedHeaders: string[];
  fullyCompatible: boolean;
};

const field = (id: string, label: string, required: boolean, aliases: string[] = []): ImportField => ({ id, label, required, aliases });

export const departmentImportFields: Record<string, ImportField[]> = {
  sales: [
    field("clientName", "Client Name", true, ["client", "customer", "company"]),
    field("projectName", "Project Name", true, ["project", "project description"]),
    field("projectManager", "Project Manager", false, ["pm", "manager"]),
    field("lpoReference", "LPO Reference", true, ["lpo", "po number", "purchase order"]),
    field("mobilizationDate", "Mobilization Date", false, ["mob date", "start date"]),
    field("clientEmail", "Client Email", false, ["email", "email id"]),
  ],
  documentation: [
    field("dossierId", "Dossier ID", true, ["booking id", "booking number", "dossier"]),
    field("documentName", "Document Name", true, ["document", "file name"]),
    field("documentType", "Document Type", false, ["type", "category"]),
    field("documentStatus", "Document Status", true, ["status", "approval status"]),
    field("expiryDate", "Expiry Date", false, ["expiry", "valid until"]),
  ],
  "lifting-gears": [
    field("gearId", "Gear ID", true, ["asset id", "gear code", "id"]),
    field("gearName", "Gear Name", true, ["name", "equipment name"]),
    field("inspectionCertificate", "Inspection Certificate", true, ["certificate", "cert number", "inspection cert"]),
    field("inspectionExpiry", "Inspection Expiry", true, ["expiry", "inspection expiry date"]),
    field("swl", "SWL", false, ["safe working load", "capacity", "tonnage"]),
  ],
  maintenance: [
    field("assetCode", "Asset Code", true, ["asset id", "equipment code", "crane code"]),
    field("serviceType", "Service Type", true, ["maintenance type", "service"]),
    field("serviceDate", "Service Date", true, ["maintenance date", "date"]),
    field("nextDue", "Next Due Date", false, ["next service", "due date"]),
    field("maintenanceStatus", "Maintenance Status", true, ["status"]),
  ],
  crew: [
    field("employeeName", "Employee Name", true, ["name", "employee", "workman"]),
    field("role", "Role", true, ["designation", "position"]),
    field("availability", "Availability", true, ["attendance", "employee status"]),
    field("certificateExpiry", "Certificate Expiry", false, ["cert expiry", "certificate valid until"]),
    field("trainingStatus", "Training Status", false, ["training", "training required"]),
  ],
  hse: [
    field("dossierId", "Dossier ID", true, ["booking id", "booking number"]),
    field("safetyItem", "Safety Item", true, ["item", "safety requirement"]),
    field("approvalStatus", "Approval Status", true, ["status", "approval"]),
    field("expiryDate", "Expiry Date", false, ["expiry", "valid until"]),
  ],
  accounts: [
    field("clientName", "Client Name", true, ["client", "customer", "company"]),
    field("lpoReference", "LPO Reference", true, ["lpo", "po number", "purchase order"]),
    field("invoiceNumber", "Invoice Number", false, ["invoice", "invoice no"]),
    field("commercialStatus", "Commercial Status", true, ["status", "account status"]),
    field("amount", "Amount", false, ["value", "total"]),
  ],
  hr: [
    field("employeeName", "Employee Name", true, ["name", "employee", "workman"]),
    field("attendanceDate", "Attendance Date", true, ["date", "work date"]),
    field("attendanceStatus", "Attendance Status", true, ["attendance", "status"]),
    field("leaveType", "Leave Type", false, ["leave", "absence type"]),
  ],
  transportation: [
    field("trailerId", "Trailer ID", true, ["trailer", "asset id", "vehicle id"]),
    field("driverName", "Driver Name", false, ["driver"]),
    field("deliveryNote", "Delivery Note", true, ["delivery note number", "dn"]),
    field("site", "Site", true, ["location", "project site"]),
    field("transportStatus", "Transport Status", true, ["status"]),
  ],
  administrator: [
    field("userName", "User Name", true, ["name", "user"]),
    field("email", "Email", true, ["email id", "user email"]),
    field("role", "Role", true, ["user role", "designation"]),
    field("activeStatus", "Active Status", true, ["status", "active"]),
  ],
};

export function normaliseHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function autoMapColumns(fields: ImportField[], headers: string[]): ColumnMapping {
  const mapped: ColumnMapping = {};
  const usedHeaders = new Set<string>();

  fields.forEach((field) => {
    const candidates = [field.label, ...field.aliases].map(normaliseHeader);
    const exact = headers.find((header) => !usedHeaders.has(header) && candidates.includes(normaliseHeader(header)));
    const partial = headers.find((header) => !usedHeaders.has(header) && candidates.some((candidate) => normaliseHeader(header).includes(candidate) || candidate.includes(normaliseHeader(header))));
    const match = exact ?? partial;
    if (match) {
      mapped[field.id] = match;
      usedHeaders.add(match);
    }
  });

  return mapped;
}

export function headerSignature(headers: string[]) {
  return headers.map(normaliseHeader).filter(Boolean).sort().join("|");
}

export function createMappingPreference(departmentId: string, mapping: ColumnMapping, headers: string[]): MappingPreference {
  return {
    departmentId,
    mapping,
    headerSignature: headerSignature(headers),
    savedAt: new Date().toISOString(),
  };
}

export function applyMappingPreference(fields: ImportField[], headers: string[], preference?: MappingPreference): PreferenceApplication {
  const automaticMapping = autoMapColumns(fields, headers);
  if (!preference) {
    return { mapping: automaticMapping, matchedCount: 0, savedCount: 0, changedHeaders: [], fullyCompatible: false };
  }

  const validFieldIds = new Set(fields.map((field) => field.id));
  const preferredEntries = Object.entries(preference.mapping).filter(([fieldId]) => validFieldIds.has(fieldId));
  const savedCount = preferredEntries.length;
  const preferredMapping: ColumnMapping = {};
  const usedHeaders = new Set<string>();
  const changedHeaders: string[] = [];

  preferredEntries.forEach(([fieldId, savedHeader]) => {
    const matchedHeader = headers.find((header) => normaliseHeader(header) === normaliseHeader(savedHeader) && !usedHeaders.has(header));
    if (matchedHeader) {
      preferredMapping[fieldId] = matchedHeader;
      usedHeaders.add(matchedHeader);
    } else {
      changedHeaders.push(savedHeader);
    }
  });

  const mapping: ColumnMapping = { ...preferredMapping };
  const consumedHeaders = new Set(Object.values(preferredMapping));
  fields.forEach((field) => {
    const fallbackHeader = automaticMapping[field.id];
    if (!mapping[field.id] && fallbackHeader && !consumedHeaders.has(fallbackHeader)) {
      mapping[field.id] = fallbackHeader;
      consumedHeaders.add(fallbackHeader);
    }
  });

  const fullyCompatible = savedCount > 0 && changedHeaders.length === 0 && missingRequiredFields(fields, mapping).length === 0;
  return { mapping, matchedCount: Object.keys(preferredMapping).length, savedCount, changedHeaders, fullyCompatible };
}

export function missingRequiredFields(fields: ImportField[], mappings: ColumnMapping) {
  return fields.filter((field) => field.required && !mappings[field.id]);
}

export function mapSpreadsheetRows(fields: ImportField[], mappings: ColumnMapping, rows: SpreadsheetRow[]) {
  return rows.map((row) => Object.fromEntries(
    fields
      .filter((field) => mappings[field.id])
      .map((field) => [field.label, row[mappings[field.id]] ?? ""]),
  ));
}

export function templateRows(fields: ImportField[]) {
  return [Object.fromEntries(fields.map((field) => [field.label, ""]))];
}
