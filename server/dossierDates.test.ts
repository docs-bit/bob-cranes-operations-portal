import { describe, expect, it } from "vitest";
import {
  formatDossierDate,
  parseDossierDate,
  validateDossierInput,
} from "@shared/dossierDates";

describe("dossierDates", () => {
  it("formats ISO dates as dossier display dates", () => {
    expect(formatDossierDate("2026-08-11")).toBe("11 Aug 2026");
    expect(formatDossierDate("not-a-date")).toBe("");
  });

  it("parses ISO and display dates", () => {
    expect(parseDossierDate("2026-08-11")?.toDateString()).toBe(
      new Date(2026, 7, 11).toDateString()
    );
    expect(parseDossierDate("11 Aug 2026")?.toDateString()).toBe(
      new Date(2026, 7, 11).toDateString()
    );
    expect(parseDossierDate("garbage")).toBeNull();
  });

  it("rejects bad emails and inverted dates", () => {
    expect(
      validateDossierInput({
        client: "",
        email: "not-an-email",
        mob: "2026-08-18",
        offHire: "2026-08-11",
      })
    ).toEqual({
      client: "Client name is required.",
      email: "Enter a valid work email.",
      offHire: "Off-hire must be after mobilization.",
    });
    expect(
      validateDossierInput({
        client: "Gulf",
        email: "ops@gulf.ae",
        mob: "2026-08-11",
        offHire: "2026-08-18",
      })
    ).toEqual({});
  });
});
