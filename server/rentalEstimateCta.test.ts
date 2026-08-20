import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public rental estimate call-to-action", () => {
  it("opens a pre-addressed email for the BOB administrator inbox", () => {
    const source = readFileSync(new URL("../client/src/pages/RentalLanding.tsx", import.meta.url), "utf8");

    expect(source).toContain('mailto:admin@bobcranes.ae?subject=${encodeURIComponent("Rental Estimate Request")}&body=${encodeURIComponent(createRentalEstimateEmailBody(input))}');
    expect(source).toContain('Equipment type: ${value("equipmentInterest", "[Select equipment type]")}');
    expect(source).toContain('Rental duration: ${value("rentalDuration", "[Select rental duration]")}');
    expect(source).toContain('const { user } = useAuth();');
    expect(source).toContain('toast.info("Opening your email client"');
    expect(source).toContain('user?.name || form.contactName');
    expect(source).toContain('user?.email || form.email');
    expect(source).toContain('user?.companyName || form.companyName');
    expect(source).toContain('user?.phone || form.phone');
    expect(source).toContain('companyName: current.companyName || user.companyName || ""');
    expect(source).toContain('phone: current.phone || user.phone || ""');
    expect(source).toContain('<span>Equipment type</span>');
    expect(source).toContain('<span>Rental duration</span>');
    expect(source).toContain('onClick={openRentalEstimateEmail}');
    expect(source).toContain('aria-label="Email admin@bobcranes.ae for a rental estimate"');
  });
});
