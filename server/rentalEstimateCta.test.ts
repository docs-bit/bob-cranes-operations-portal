import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public rental estimate call-to-action", () => {
  it("opens a pre-addressed email for the BOB administrator inbox", () => {
    const source = readFileSync(new URL("../client/src/pages/RentalLanding.tsx", import.meta.url), "utf8");

    expect(source).toContain('mailto:admin@bobcranes.ae?subject=${encodeURIComponent("Rental Estimate Request")}&body=${encodeURIComponent(RENTAL_ESTIMATE_EMAIL_BODY)}');
    expect(source).toContain('Equipment type: [e.g. Mobile crane / Crawler crane / Lifting gear]');
    expect(source).toContain('Rental duration: [e.g. 1 day / 1 week / 1 month]');
    expect(source).toContain('onClick={openRentalEstimateEmail}');
    expect(source).toContain('aria-label="Email admin@bobcranes.ae for a rental estimate"');
  });
});
