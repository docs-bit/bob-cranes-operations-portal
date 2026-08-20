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
    const source = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");

    expect(source).toContain("trpc.auth.updateMyContactDetails.useMutation()");
    expect(source).toContain("Rental estimate contact");
    expect(source).toContain('data-testid="unassigned-enquiry-status"');
    expect(source).toContain('setView("sales-enquiries")');
  });
});
