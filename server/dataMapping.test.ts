import { describe, expect, it } from "vitest";
import { autoMapColumns, mapSpreadsheetRows, missingRequiredFields, type ImportField } from "../shared/dataMapping";

const fields: ImportField[] = [
  { id: "clientName", label: "Client Name", required: true, aliases: ["client"] },
  { id: "lpoReference", label: "LPO Reference", required: true, aliases: ["lpo"] },
  { id: "email", label: "Client Email", required: false, aliases: ["email"] },
];

describe("department data mapping", () => {
  it("auto-maps canonical and alias spreadsheet headers", () => {
    expect(autoMapColumns(fields, ["Client", "LPO", "Email"])).toEqual({
      clientName: "Client",
      lpoReference: "LPO",
      email: "Email",
    });
  });

  it("identifies unmet required system fields", () => {
    expect(missingRequiredFields(fields, { clientName: "Client" }).map((field) => field.id)).toEqual(["lpoReference"]);
  });

  it("creates export-ready rows using confirmed mappings", () => {
    expect(mapSpreadsheetRows(fields, { clientName: "Client", lpoReference: "LPO" }, [{ Client: "Gulf Contracting", LPO: "LPO-14" }])).toEqual([
      { "Client Name": "Gulf Contracting", "LPO Reference": "LPO-14" },
    ]);
  });
});

