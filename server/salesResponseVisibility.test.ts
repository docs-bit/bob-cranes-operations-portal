import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Sales response visibility", () => {
  it("keeps rental duration visible in the Sales enquiry table and detail modal", () => {
    const source = readFileSync(new URL("../client/src/components/SalesEnquiryInbox.tsx", import.meta.url), "utf8");

    expect(source).toContain('className="sales-enquiry-duration"');
    expect(source).toContain('<span>Rental duration</span>');
    expect(source).toContain('selected.rentalDuration ?? "To be confirmed"');
  });

  it("provides self-service profile contact settings and an unassigned enquiry dashboard status", () => {
    const overviewSource = readFileSync(new URL("../client/src/pages/views/Overview.tsx", import.meta.url), "utf8");
    const shellSource = readFileSync(new URL("../client/src/pages/views/Shell.tsx", import.meta.url), "utf8");

    expect(shellSource).toContain("trpc.auth.updateMyContactDetails.useMutation()");
    expect(shellSource).toContain("Rental estimate contact");
    expect(overviewSource).toContain('data-testid="unassigned-enquiry-status"');
    expect(overviewSource).toContain('setView("sales-enquiries")');
  });
});
