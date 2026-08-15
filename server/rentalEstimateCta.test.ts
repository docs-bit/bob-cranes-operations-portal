import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public rental estimate call-to-action", () => {
  it("opens a pre-addressed email for the BOB administrator inbox", () => {
    const source = readFileSync(new URL("../client/src/pages/RentalLanding.tsx", import.meta.url), "utf8");

    expect(source).toContain('mailto:admin@bobcranes.ae?subject=Rental%20Estimate%20Request');
    expect(source).toContain('onClick={openRentalEstimateEmail}');
    expect(source).toContain('aria-label="Email admin@bobcranes.ae for a rental estimate"');
  });
});
