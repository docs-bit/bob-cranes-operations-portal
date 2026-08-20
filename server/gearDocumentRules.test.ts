import { describe, expect, it } from "vitest";
import { canSelectGearForBooking, formatGearValidityDate, gearDocumentStatus, isValidGearDocumentPeriod } from "../shared/gearDocumentRules";

describe("lifting gear document validity", () => {
  it("requires an ordered validity period", () => {
    expect(isValidGearDocumentPeriod("2026-08-01", "2026-08-31")).toBe(true);
    expect(isValidGearDocumentPeriod("2026-08-31", "2026-08-01")).toBe(false);
    expect(isValidGearDocumentPeriod("", "2026-08-31")).toBe(false);
  });

  it("hard-blocks a document whose validity has expired", () => {
    const today = new Date("2026-08-14T09:00:00");
    expect(gearDocumentStatus("2026-08-13", today)).toBe("Expired");
    expect(gearDocumentStatus("2026-08-14", today)).toBe("Compliant");
    expect(formatGearValidityDate("2026-08-31")).toBe("31 Aug 2026");
    expect(canSelectGearForBooking("Expired")).toBe(false);
    expect(canSelectGearForBooking("Compliant")).toBe(true);
  });
});
