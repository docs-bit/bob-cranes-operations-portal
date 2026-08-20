import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Sales response-controls expansion", () => {
  it("persists SLA thresholds and enquiry event records", () => {
    const schema = read("../drizzle/schema.ts");
    const db = read("./db.ts");
    const router = read("./routers.ts");

    expect(schema).toContain("export const rentalEnquiryEvents");
    expect(db).toContain("getSalesEnquirySlaConfig");
    expect(db).toContain("setSalesEnquirySlaConfig");
    expect(db).toContain("createRentalEnquiryEvent");
    expect(router).toContain("recordQuickReply");
    expect(router).toContain("getAuditEvents");
    expect(router).toContain("updateSlaConfig");
    expect(router).toContain("Only administrators can update Sales SLA thresholds.");
  });

  it("supports saved queues and records quick-reply history in the Sales workspace", () => {
    const source = read("../client/src/components/SalesEnquiryInbox.tsx");

    expect(source).toContain("bob-sales-filter-presets");
    expect(source).toContain("savePreset");
    expect(source).toContain("applyPreset");
    expect(source).toContain("recordQuickReply.mutateAsync");
    expect(source).toContain("Quick-reply audit trail");
    expect(source).toContain("Admin SLA settings");
  });

  it("maps unassigned wait time to a visible SLA severity and honors reduced motion", () => {
    const page = read("../client/src/pages/Home.tsx");
    const styles = read("../client/src/index.css");

    expect(page).toContain("unassignedOldestWaitHours");
    expect(page).toContain('unassignedSeverity === "critical"');
    expect(page).toContain('unassignedSeverity === "warning"');
    expect(styles).toContain(".unassigned-enquiry-status.critical");
    expect(styles).toContain(".unassigned-enquiry-status.warning");
    expect(styles).toContain("prefers-reduced-motion");
  });
});
