import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
const crew = readFileSync(new URL("../client/src/components/CrewAssignmentWorkspace.tsx", import.meta.url), "utf8");

describe("page-local search behavior", () => {
  it("keeps the shared header dossier finder on dossier-related views only", () => {
    expect(home).toContain('const canSearchDossiers = view === "overview" || view === "bookings" || view === "detail"');
    expect(home).toContain("{canSearchDossiers && <><button");
  });

  it("matches the detailed data rendered by booking, training, attendance, and crew pages", () => {
    expect(home).toContain("booking.stage,");
    expect(home).toContain("booking.priority,");
    expect(home).toContain("JSON.stringify(employee.certifications)");
    expect(home).toContain("record[employee.name]");
    expect(crew).toContain("bookingIdsByCrew");
    expect(crew).toContain("${crew.name} ${crew.sourceId} ${crew.role} ${crew.department} ${crew.bookingIds.join(\" \")}");
  });
});
