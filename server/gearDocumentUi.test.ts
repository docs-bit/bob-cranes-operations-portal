import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("lifting gear document workflow wiring", () => {
  it("keeps the document upload, validity period, and expired-gear guard connected in the UI", () => {
    const home = readFileSync(new URL("../client/src/pages/views/GearView.tsx", import.meta.url), "utf8");
    expect(home).toContain('aria-label="Upload lifting gear inspection documents"');
    expect(home).toContain("Document valid from");
    expect(home).toContain("Document valid until");
    expect(home).toContain("isValidGearDocumentPeriod");
    expect(home).toContain("gearDocumentStatus(form.validUntil)");
    expect(home).toContain("gears.push(record)");
    expect(home).toContain("gear.status === \"Expired\"");
    expect(home).toContain("Selection blocked");
  });

  it("keeps storage upload authorization and the protected gear route in place", () => {
    const router = readFileSync(new URL("../server/routers/operations.ts", import.meta.url), "utf8");
    const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    expect(router).toContain("uploadGearDocument");
    expect(router).toContain('requireDepartmentAccess(ctx.user, "lifting-gears")');
    expect(router).toContain("storagePut(");
    expect(router).toContain("`lifting-gears/${ctx.user.id}/");
    expect(app).toContain('<Route path={"/gear"} component={ProtectedPortal} />');
  });
});
